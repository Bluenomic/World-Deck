import type { WorldProject } from '../types';

const DB_NAME = 'WorldDeckDatabase_v1';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Saves worlds array & active world ID asynchronously to IndexedDB & LocalStorage
 */
export const saveAppState = async (worlds: WorldProject[], activeWorldId: string) => {
  // 1. Save to IndexedDB (Supports large base64 images & unlimited data)
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(worlds, 'worlds_data');
    store.put(activeWorldId, 'active_world_id');
  } catch (err) {
    console.warn('IndexedDB save warning:', err);
  }

  // 2. Backup to LocalStorage (with try-catch for quota safety)
  try {
    localStorage.setItem('worlddeck_worlds_v2', JSON.stringify(worlds));
    localStorage.setItem('worlddeck_active_id_v2', activeWorldId);
  } catch (err) {
    // Quota exceeded in localStorage, IndexedDB already has the full backup
    console.warn('LocalStorage quota limit reached, saved to IndexedDB instead.');
  }
};

/**
 * Loads worlds array & active world ID on app initial startup
 */
export const loadAppState = async (): Promise<{ worlds: WorldProject[]; activeWorldId: string } | null> => {
  // 1. Attempt loading from IndexedDB first
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    const worldsPromise = new Promise<WorldProject[] | null>((resolve) => {
      const req = store.get('worlds_data');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });

    const activeIdPromise = new Promise<string | null>((resolve) => {
      const req = store.get('active_world_id');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });

    const [idbWorlds, idbActiveId] = await Promise.all([worldsPromise, activeIdPromise]);

    if (idbWorlds && Array.isArray(idbWorlds) && idbWorlds.length > 0) {
      const validActiveId = idbActiveId && idbWorlds.some((w) => w.id === idbActiveId)
        ? idbActiveId
        : idbWorlds[0].id;
      return { worlds: idbWorlds, activeWorldId: validActiveId };
    }
  } catch (err) {
    console.warn('IndexedDB load warning:', err);
  }

  // 2. Fallback to LocalStorage if IndexedDB fails or is empty
  try {
    const savedWorlds = localStorage.getItem('worlddeck_worlds_v2') || localStorage.getItem('worldarchive_worlds_v2') || localStorage.getItem('worldweaver_worlds_v2');
    const savedActiveId = localStorage.getItem('worlddeck_active_id_v2') || localStorage.getItem('worldarchive_active_id_v2') || localStorage.getItem('worldweaver_active_id_v2');

    if (savedWorlds) {
      const parsed = JSON.parse(savedWorlds);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const validId = savedActiveId && parsed.some((w: WorldProject) => w.id === savedActiveId)
          ? savedActiveId
          : parsed[0].id;
        return { worlds: parsed, activeWorldId: validId };
      }
    }
  } catch (err) {
    console.warn('LocalStorage load warning:', err);
  }

  return null;
};

/**
 * Saves FileSystemFileHandle to IndexedDB
 */
export const saveLocalFileHandle = async (handle: any) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    if (handle) {
      await store.put(handle, 'linked_file_handle');
    } else {
      await store.delete('linked_file_handle');
    }
  } catch (err) {
    console.warn('IndexedDB save file handle warning:', err);
  }
};

/**
 * Loads FileSystemFileHandle from IndexedDB
 */
export const loadLocalFileHandle = async (): Promise<any | null> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve) => {
      const req = store.get('linked_file_handle');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
};
