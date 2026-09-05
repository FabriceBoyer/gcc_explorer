/**
 * A ~40 line IndexedDB key/value store.
 *
 * The dataset is a few megabytes of JSON that only changes when the data
 * pipeline is re-run, so it is fetched once and then read from the browser on
 * every later visit. IndexedDB is used rather than `localStorage` because the
 * payload is far past the 5 MB string quota.
 */

const DB_NAME = 'gcc-explorer';
const STORE = 'dataset';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T | null> {
  return openDb().then((db) => {
    if (!db) return null;
    return new Promise<T | null>((resolve) => {
      let req: IDBRequest;
      try {
        req = fn(db.transaction(STORE, mode).objectStore(STORE));
      } catch {
        return resolve(null);
      }
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(null);
    });
  });
}

export const idbGet = <T>(key: string) => run<T>('readonly', (s) => s.get(key));
export const idbSet = (key: string, value: unknown) => run('readwrite', (s) => s.put(value, key));
export const idbDel = (key: string) => run('readwrite', (s) => s.delete(key));
export const idbKeys = () => run<IDBValidKey[]>('readonly', (s) => s.getAllKeys());

export async function idbClear(): Promise<void> {
  await run('readwrite', (s) => s.clear());
}
