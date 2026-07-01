import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  getAllCachedUsers,
  putUsers,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
  getLastSyncDate,
  clearCache,
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
      console.log('Executing getDocs for query:', q);
      const snapshot = await getDocs(q);
      console.log(`Query succeeded. Fetched ${snapshot.size} documents.`);
      
      const docs = snapshot.docs.map(serializeDoc);

      // Cache everything
      await putUsers(docs);

      // Store the latest created_at as the sync watermark
      if (docs.length > 0) {
        const latestTimestamp = docs[docs.length - 1].created_at;
        await setLastSyncTimestamp(latestTimestamp);
      }

      return docs;
    } catch (err) {
      console.error('--- DIAGNOSTIC: QUERY FAILURE ---');
      console.error('Error Code:', err.code);
      console.error('Error Message:', err.message);
      console.error('Error Stack:', err.stack);
      throw err;
    }
  }, []);

  /**
   * Delta fetch: only documents created after the last sync timestamp.
   */
  const deltaFetch = useCallback(async (lastTimestamp) => {
    const lastDate = new Date(lastTimestamp);
    const firestoreTimestamp = Timestamp.fromDate(lastDate);

    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(
      usersRef,
      where('created_at', '>', firestoreTimestamp),
      orderBy('created_at', 'asc')
    );
    const snapshot = await getDocs(q);

    const newDocs = snapshot.docs.map(serializeDoc);

    if (newDocs.length > 0) {
      await putUsers(newDocs);
      const latestTimestamp = newDocs[newDocs.length - 1].created_at;
      await setLastSyncTimestamp(latestTimestamp);
    }

    return newDocs;
  }, []);

  /**
   * Manual/auto sync trigger — performs delta fetch and merges results.
   */
  const triggerSync = useCallback(async () => {
    setIsSyncing(true);
    setError(null);

    try {
      // Fetch Auth User Count in background
      try {
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const fns = getFunctions(db.app);
        const getAuthUserCountFn = httpsCallable(fns, 'getAuthUserCount');
        const res = await getAuthUserCountFn();
        if (res.data && typeof res.data.count === 'number') {
          setAuthUserCount(res.data.count);
        }
      } catch (err) {
        console.warn('Could not fetch Auth user count (Cloud Function getAuthUserCount might not be deployed yet):', err.message);
      }

      const lastTimestamp = await getLastSyncTimestamp();

      if (!lastTimestamp) {
        // No cache exists — do a full fetch
        const allDocs = await fullFetch();
        setUsers(allDocs);
      } else {
        // Delta fetch — only new documents
        const newDocs = await deltaFetch(lastTimestamp);

        if (newDocs.length > 0) {
          setUsers((prev) => {
            // Merge, deduplicating by ID
            const existingMap = new Map(prev.map((u) => [u.id, u]));
            for (const doc of newDocs) {
              existingMap.set(doc.id, doc);
            }
            return Array.from(existingMap.values());
          });
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
  }, [fullFetch, deltaFetch]);

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

        if (cachedUsers.length > 0) {
          if (!cancelled) {
            setUsers(cachedUsers);
            setLastSynced(lastSyncDate);
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
