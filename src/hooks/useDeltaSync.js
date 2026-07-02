import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  limit,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  getAllCachedUsers,
  putUsers,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
  getLastSyncDate,
  clearCache,
  syncAllCachedUsers,
  deleteUsers,
  getCachedAuthUserCount,
  setCachedAuthUserCount,
} from '../services/indexedDB';

const USERS_COLLECTION = 'users';
const AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Converts a Firestore Timestamp to an ISO string for storage.
 */
function timestampToISO(ts) {
  if (ts && typeof ts.toDate === 'function') {
    return ts.toDate().toISOString();
  }
  if (ts instanceof Date) {
    return ts.toISOString();
  }
  if (typeof ts === 'string') {
    return new Date(ts).toISOString();
  }
  return new Date().toISOString();
}

/**
 * Serializes a Firestore document into a plain object safe for IndexedDB.
 */
function serializeDoc(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    email: data.email || '',
    full_name: data.full_name || '',
    phone_number: data.phone_number || '',
    pharmacy_name: data.pharmacy_name || '',
    role: data.role || '',
    state: data.state || '',
    updated_state: data.updated_state || '',
    location: data.location || '',
    created_at: timestampToISO(data.created_at),
    last_activity: timestampToISO(data.last_activity),
    status: data.status || '',
    level: data.level || '',
    terms_of_use_accepted: data.terms_of_use_accepted || false,
    solved_otc: data.solved_otc || 0,
    solved_hair: data.solved_hair || 0,
    solved_skin: data.solved_skin || 0,
  };
}

/**
 * Core Delta Fetch hook.
 *
 * - On first visit: fetches ALL users from Firestore, caches to IndexedDB.
 * - On subsequent visits: loads from cache instantly, then delta-syncs new docs.
 * - Manual refresh: call triggerSync() — only fetches docs newer than last sync.
 * - Auto-refresh: every 30 minutes.
 *
 * All UI filtering operates on the returned `users` array — ZERO Firestore reads.
 */
export function useDeltaSync() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const [error, setError] = useState(null);
  const [authUserCount, setAuthUserCount] = useState(null);
  const autoSyncTimerRef = useRef(null);

  /**
   * Fetches the Firebase Auth account count in the background and caches it.
   */
  const fetchAuthCount = useCallback(async () => {
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const fns = getFunctions(db.app);
      const getAuthUserCountFn = httpsCallable(fns, 'getAuthUserCount');
      const res = await getAuthUserCountFn();
      if (res.data && typeof res.data.count === 'number') {
        setAuthUserCount(res.data.count);
        await setCachedAuthUserCount(res.data.count);
      }
    } catch (err) {
      console.warn('Could not fetch Auth user count:', err.message);
    }
  }, []);

  /**
   * Fetches ALL documents (initial full load).
   */
  const fullFetch = useCallback(async () => {
    console.log('--- DIAGNOSTIC: STARTING FULL FETCH ---');
    console.log('Firebase App Config Project ID:', db.app.options.projectId);
    
    // Import auth and doc helpers
    const { auth } = await import('../config/firebase');
    const { doc, getDoc } = await import('firebase/firestore');
    
    const currentUser = auth.currentUser;
    if (currentUser) {
      console.log('Authenticated User UID:', currentUser.uid);
      console.log('Authenticated User Email:', currentUser.email);
      
      // 1. Try reading the admin's own profile under /users/UID
      try {
        console.log('Diagnostic Read: Trying to read single doc /users/' + currentUser.uid);
        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        console.log('Success! User profile exists:', userSnap.exists(), userSnap.data());
      } catch (err) {
        console.error('Diagnostic Read Failed for /users/' + currentUser.uid + ':', err.code, err.message);
      }

      // 2. Try reading the admin status under /admins/UID
      try {
        console.log('Diagnostic Read: Trying to read single doc /admins/' + currentUser.uid);
        const adminSnap = await getDoc(doc(db, 'admins', currentUser.uid));
        console.log('Success! Admin document exists:', adminSnap.exists(), adminSnap.data());
      } catch (err) {
        console.error('Diagnostic Read Failed for /admins/' + currentUser.uid + ':', err.code, err.message);
      }
    } else {
      console.warn('DIAGNOSTIC WARNING: No user is authenticated in Firebase Auth!');
    }

    console.log('Targeting Collection:', USERS_COLLECTION);
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(usersRef, orderBy('created_at', 'asc'));
    
    try {
      // 1. Fetch latest watermark from sync_changes
      let latestWatermark = new Date().toISOString();
      try {
        const changesRef = collection(db, 'sync_changes');
        const qLatest = query(changesRef, orderBy('timestamp', 'desc'), limit(1));
        const snapLatest = await getDocs(qLatest);
        if (!snapLatest.empty) {
          const latestDocData = snapLatest.docs[0].data();
          if (latestDocData.timestamp) {
            latestWatermark = timestampToISO(latestDocData.timestamp);
          }
        }
      } catch (err) {
        console.warn('Could not fetch latest change watermark, falling back to current time:', err.message);
      }

      console.log('Executing getDocs for query:', q);
      const snapshot = await getDocs(q);
      console.log(`Query succeeded. Fetched ${snapshot.size} documents.`);
      
      const docs = snapshot.docs.map(serializeDoc);

      // Cache everything using smart sync
      await syncAllCachedUsers(docs);

      // Store the latest watermark
      await setLastSyncTimestamp(latestWatermark);

      // Fetch auth count in background
      fetchAuthCount();

      return docs;
    } catch (err) {
      console.error('--- DIAGNOSTIC: QUERY FAILURE ---');
      console.error('Error Code:', err.code);
      console.error('Error Message:', err.message);
      console.error('Error Stack:', err.stack);
      throw err;
    }
  }, [fetchAuthCount]);

  /**
   * Delta fetch: query sync_changes and fetch/update only changed records in IndexedDB.
   */
  const deltaFetch = useCallback(async (lastTimestamp) => {
    const lastDate = new Date(lastTimestamp);
    const firestoreTimestamp = Timestamp.fromDate(lastDate);

    // 1. Query the change log
    const changesRef = collection(db, 'sync_changes');
    const q = query(
      changesRef,
      where('timestamp', '>', firestoreTimestamp),
      orderBy('timestamp', 'asc')
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { updated: [], deleted: [], fullSyncRequired: false };
    }

    // 2. Aggregate changes chronologically
    const statusMap = new Map(); // userId -> 'update' | 'delete'
    let latestWatermark = lastTimestamp;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      if (data.userId) {
        statusMap.set(data.userId, data.type);
      }
      if (data.timestamp) {
        latestWatermark = timestampToISO(data.timestamp);
      }
    }

    // 3. If change volume is large, signal for full sync
    if (statusMap.size >= 25) {
      console.log(`Delta fetch found ${statusMap.size} unique user changes. Triggering full resync.`);
      return { fullSyncRequired: true };
    }

    const updatedIds = [];
    const deletedIds = [];
    for (const [userId, type] of statusMap.entries()) {
      if (type === 'delete') {
        deletedIds.push(userId);
      } else {
        updatedIds.push(userId);
      }
    }

    // 4. Apply deletions to local cache
    if (deletedIds.length > 0) {
      await deleteUsers(deletedIds);
    }

    // 5. Fetch updated/new documents from Firestore in parallel
    const updatedDocs = [];
    if (updatedIds.length > 0) {
      const { doc, getDoc } = await import('firebase/firestore');
      const fetchPromises = updatedIds.map(async (id) => {
        try {
          const userSnap = await getDoc(doc(db, USERS_COLLECTION, id));
          if (userSnap.exists()) {
            return serializeDoc(userSnap);
          } else {
            // Treat as deleted if it doesn't exist in Firestore anymore
            deletedIds.push(id);
            return null;
          }
        } catch (err) {
          console.error(`Error fetching updated user ${id}:`, err);
          return null;
        }
      });
      const fetched = await Promise.all(fetchPromises);
      for (const u of fetched) {
        if (u) updatedDocs.push(u);
      }
    }

    // 6. Apply updates to local cache
    if (updatedDocs.length > 0) {
      await putUsers(updatedDocs);
    }

    // 7. Update local watermark
    await setLastSyncTimestamp(latestWatermark);

    return {
      updated: updatedDocs,
      deleted: deletedIds,
      fullSyncRequired: false
    };
  }, []);

  /**
   * Manual/auto sync trigger — performs delta fetch and merges results.
   */
  const triggerSync = useCallback(async () => {
    setIsSyncing(true);
    setError(null);

    try {
      // Fetch Auth User Count in background
      fetchAuthCount();

      const lastTimestamp = await getLastSyncTimestamp();

      if (!lastTimestamp) {
        // No cache exists — do a full fetch
        const allDocs = await fullFetch();
        setUsers(allDocs);
      } else {
        // Delta fetch — only new/modified/deleted documents
        const result = await deltaFetch(lastTimestamp);

        if (result.fullSyncRequired) {
          const allDocs = await fullFetch();
          setUsers(allDocs);
        } else {
          const { updated, deleted } = result;
          if (updated.length > 0 || deleted.length > 0) {
            setUsers((prev) => {
              const userMap = new Map(prev.map((u) => [u.id, u]));
              // Remove deleted ones
              for (const id of deleted) {
                userMap.delete(id);
              }
              // Update/insert updated ones
              for (const u of updated) {
                userMap.set(u.id, u);
              }
              return Array.from(userMap.values());
            });
          }
        }
      }

      const syncDate = new Date().toISOString();
      setLastSynced(syncDate);
    } catch (err) {
      console.error('Sync failed:', err);
      setError(err.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  }, [fullFetch, deltaFetch, fetchAuthCount]);

  /**
   * Hard reset: clears all cache and re-fetches everything.
   */
  const hardReset = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await clearCache();
      const allDocs = await fullFetch();
      setUsers(allDocs);
      setLastSynced(new Date().toISOString());
    } catch (err) {
      console.error('Hard reset failed:', err);
      setError(err.message || 'Reset failed');
    } finally {
      setIsLoading(false);
    }
  }, [fullFetch]);

  /**
   * Initial load: try cache first, then sync.
   */
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // 1. Load from cache immediately
        const cachedUsers = await getAllCachedUsers();
        const lastSyncDate = await getLastSyncDate();
        const cachedAuthCount = await getCachedAuthUserCount();

        if (cachedUsers.length > 0) {
          if (!cancelled) {
            setUsers(cachedUsers);
            setLastSynced(lastSyncDate);
            setAuthUserCount(cachedAuthCount);
            setIsLoading(false);
          }

          // 2. Delta sync in the background
          if (!cancelled) {
            await triggerSync();
          }
        } else {
          // No cache — full fetch
          if (!cancelled) {
            const allDocs = await fullFetch();
            setUsers(allDocs);
            setLastSynced(new Date().toISOString());
          }
        }
      } catch (err) {
        console.error('Initial load failed:', err);
        if (!cancelled) {
          setError(err.message || 'Failed to load data');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [fullFetch, triggerSync]);

  /**
   * Auto-sync timer: delta sync every 30 minutes.
   */
  useEffect(() => {
    autoSyncTimerRef.current = setInterval(() => {
      triggerSync();
    }, AUTO_SYNC_INTERVAL_MS);

    return () => {
      if (autoSyncTimerRef.current) {
        clearInterval(autoSyncTimerRef.current);
      }
    };
  }, [triggerSync]);

  return {
    users,
    isLoading,
    isSyncing,
    lastSynced,
    error,
    triggerSync,
    hardReset,
    authUserCount,
  };
}
