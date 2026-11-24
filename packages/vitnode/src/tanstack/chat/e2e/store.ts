import React from "react";

/**
 * The unlocked private key, kept in memory and - when the member chose
 * "Remember on this device" - in IndexedDB as a non-extractable `CryptoKey`
 * (scripts on this site can use it, nobody can read its bytes). Chat keys
 * are cached in memory only. Browser-only.
 */
interface UnlockedIdentity {
  keyVersion: number;
  privateKey: CryptoKey;
  userId: number;
}

const DB_NAME = "vitnode-chat-e2e";
const STORE = "identity";

let identity: null | UnlockedIdentity = null;
let restoredFor: null | number = null;
const chatKeys = new Map<number, { key: CryptoKey; keyVersion: number }>();
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

const openDb = async (): Promise<IDBDatabase | null> =>
  new Promise(resolve => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE);
      };
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<null | T> => {
  const db = await openDb();
  if (!db) return null;

  return await new Promise(resolve => {
    try {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
};

export const e2eStore = {
  /** Who is unlocked, if anyone. */
  current: (): null | UnlockedIdentity => identity,

  /** Keeps the key for this tab, and on this device when `remember`. */
  async unlock(next: UnlockedIdentity, remember: boolean): Promise<void> {
    identity = next;
    chatKeys.clear();
    emit();
    if (remember) {
      await withStore("readwrite", store => store.put(next, next.userId));
    } else {
      await withStore("readwrite", store => store.delete(next.userId));
    }
  },

  /** Forgets the key here and on this device. */
  async lock(userId: number): Promise<void> {
    identity = null;
    chatKeys.clear();
    emit();
    await withStore("readwrite", store => store.delete(userId));
  },

  /** Brings back a key remembered on this device, once per member. */
  async restore(userId: number): Promise<void> {
    if (restoredFor === userId) return;
    restoredFor = userId;
    if (identity?.userId === userId) return;
    const saved = await withStore<undefined | UnlockedIdentity>(
      "readonly",
      store => store.get(userId) as IDBRequest<undefined | UnlockedIdentity>,
    );
    if (saved?.privateKey && identity === null) {
      identity = saved;
      emit();
    }
  },

  /** Signed out or another member signed in: drop everything in memory. */
  forget(): void {
    identity = null;
    restoredFor = null;
    chatKeys.clear();
    emit();
  },

  chatKey(chatId: number, keyVersion: number): CryptoKey | null {
    const cached = chatKeys.get(chatId);

    return cached?.keyVersion === keyVersion ? cached.key : null;
  },

  setChatKey(chatId: number, keyVersion: number, key: CryptoKey): void {
    chatKeys.set(chatId, { key, keyVersion });
    emit();
  },

  /** Any chat key cached for `chatId`, whatever version (for list previews). */
  anyChatKey(chatId: number): CryptoKey | null {
    return chatKeys.get(chatId)?.key ?? null;
  },

  subscribe(listener: () => void) {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  },
};

let version = 0;
e2eStore.subscribe(() => {
  version++;
});

/** Re-renders when the unlocked key or a chat key changes. */
export const useE2EStoreVersion = (): number =>
  React.useSyncExternalStore(
    e2eStore.subscribe,
    () => version,
    () => 0,
  );
