import { openDB } from 'idb';

const DB_NAME = 'meddigi-cache';
const DB_VERSION = 1;
const USERS_STORE = 'users';
const META_STORE = 'meta';

/**
 * Opens (or creates) the IndexedDB database with two object stores:
 * - 'users': stores cached user documents keyed by Firestore doc ID
 * - 'meta': stores sync metadata (lastSyncTimestamp, lastSyncDate)
 */
async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(USERS_STORE)) {
        db.createObjectStore(USERS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    },
  });
}

/**
 * Returns all cached user documents from IndexedDB.
 */
export async function getAllCachedUsers() {
  const db = await getDB();
  return db.getAll(USERS_STORE);
}

/**
 * Writes an array of user objects into the cache.
 * Uses a transaction to batch all puts for performance.
 */
export async function putUsers(users) {
  const db = await getDB();
  const tx = db.transaction(USERS_STORE, 'readwrite');
  const store = tx.objectStore(USERS_STORE);
  for (const user of users) {
    await store.put(user);
  }
  await tx.done;
}

/**
 * Synchronizes the local IndexedDB cache with the complete set of users fetched from Firestore.
 * - Deletes cached users that are no longer in the fetched list.
 * - Writes/updates only the users that are new or whose data has changed.
 */
export async function syncAllCachedUsers(fetchedUsers) {
  const db = await getDB();
  const tx = db.transaction(USERS_STORE, 'readwrite');
  const store = tx.objectStore(USERS_STORE);

  // 1. Get all cached IDs
  const cachedKeys = await store.getAllKeys();
  const fetchedMap = new Map(fetchedUsers.map(u => [u.id, u]));

  // 2. Delete users that do not exist in the fetched list
  for (const id of cachedKeys) {
    if (!fetchedMap.has(id)) {
      await store.delete(id);
    }
  }

  // 3. Put only updated/new users
  for (const user of fetchedUsers) {
    const cachedUser = await store.get(user.id);
    if (!cachedUser || JSON.stringify(cachedUser) !== JSON.stringify(user)) {
      await store.put(user);
    }
  }

  await tx.done;
}

/**
 * Deletes a list of users from the local cache.
 */
export async function deleteUsers(userIds) {
  const db = await getDB();
  const tx = db.transaction(USERS_STORE, 'readwrite');
  const store = tx.objectStore(USERS_STORE);
  for (const id of userIds) {
    await store.delete(id);
  }
  await tx.done;
}

/**
 * Gets the last sync timestamp (as an ISO string) from the meta store.
 * Returns null if no sync has ever occurred.
 */
export async function getLastSyncTimestamp() {
  const db = await getDB();
  return db.get(META_STORE, 'lastSyncTimestamp') || null;
}

/**
 * Stores the latest sync timestamp (ISO string) and the current date/time.
 */
export async function setLastSyncTimestamp(timestamp) {
  const db = await getDB();
  const tx = db.transaction(META_STORE, 'readwrite');
  const store = tx.objectStore(META_STORE);
  await store.put(timestamp, 'lastSyncTimestamp');
  await store.put(new Date().toISOString(), 'lastSyncDate');
  await tx.done;
}

/**
 * Returns the date/time of the last successful sync operation.
 */
export async function getLastSyncDate() {
  const db = await getDB();
  return db.get(META_STORE, 'lastSyncDate') || null;
}

/**
 * Clears all cached data and metadata. Used for hard resets.
 */
export async function clearCache() {
  const db = await getDB();
  const tx1 = db.transaction(USERS_STORE, 'readwrite');
  await tx1.objectStore(USERS_STORE).clear();
  await tx1.done;

  const tx2 = db.transaction(META_STORE, 'readwrite');
  await tx2.objectStore(META_STORE).clear();
  await tx2.done;
}

/**
 * Gets the cached Firebase Auth user count.
 */
export async function getCachedAuthUserCount() {
  const db = await getDB();
  return db.get(META_STORE, 'authUserCount') || null;
}

/**
 * Caches the Firebase Auth user count.
 */
export async function setCachedAuthUserCount(count) {
  const db = await getDB();
  const tx = db.transaction(META_STORE, 'readwrite');
  const store = tx.objectStore(META_STORE);
  await store.put(count, 'authUserCount');
  await tx.done;
}
