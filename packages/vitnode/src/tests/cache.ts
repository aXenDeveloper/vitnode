import type { Context } from "hono";

import type { CacheClient } from "@/api/lib/cache";

import { CacheModel } from "@/api/lib/cache";

interface SetOptions {
  condition?: "NX";
}

export const createTestCacheClient = (): CacheClient => {
  const store = new Map<string, string>();

  const client = {
    del: async (keys: string | string[]) => {
      const removed = (Array.isArray(keys) ? keys : [keys]).filter(key =>
        store.delete(key),
      );

      return Promise.resolve(removed.length);
    },
    exists: async (key: string) => Promise.resolve(store.has(key) ? 1 : 0),
    get: async (key: string) => Promise.resolve(store.get(key) ?? null),
    ping: async () => Promise.resolve("PONG"),
    set: async (key: string, value: string, options?: SetOptions) => {
      if (options?.condition === "NX" && store.has(key)) {
        return Promise.resolve(null);
      }
      store.set(key, value);

      return Promise.resolve("OK");
    },
  };

  return client as unknown as CacheClient;
};

const contextWithoutPlugin = { get: () => undefined } as unknown as Context;

export const createTestCache = (
  client: CacheClient = createTestCacheClient(),
  c: Context = contextWithoutPlugin,
): CacheModel => new CacheModel(client, c);
