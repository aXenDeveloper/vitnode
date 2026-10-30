import type { Context } from "hono";

import type { CacheClient } from "@/api/lib/cache";

import { CacheModel } from "@/api/lib/cache";

interface SetOptions {
  condition?: "NX";
}

const scoreBound = (bound: number | string): number => {
  if (bound === "+inf") return Number.POSITIVE_INFINITY;
  if (bound === "-inf") return Number.NEGATIVE_INFINITY;

  return Number(bound);
};

export const createTestCacheClient = (): CacheClient => {
  const store = new Map<string, string>();
  const sortedSets = new Map<string, Map<string, number>>();

  const membersIn = (
    key: string,
    min: number | string,
    max: number | string,
  ): string[] =>
    [...(sortedSets.get(key) ?? new Map<string, number>())]
      .filter(
        ([, score]) => score >= scoreBound(min) && score <= scoreBound(max),
      )
      .map(([member]) => member);

  const client = {
    expire: async () => Promise.resolve(1),
    zAdd: async (
      key: string,
      { score, value }: { score: number; value: string },
    ) => {
      const set = sortedSets.get(key) ?? new Map<string, number>();
      set.set(value, score);
      sortedSets.set(key, set);

      return Promise.resolve(1);
    },
    zCount: async (key: string, min: number | string, max: number | string) =>
      Promise.resolve(membersIn(key, min, max).length),
    zRem: async (key: string, members: string | string[]) => {
      const set = sortedSets.get(key);
      const removed = (Array.isArray(members) ? members : [members]).filter(
        member => set?.delete(member),
      );

      return Promise.resolve(removed.length);
    },
    zRemRangeByScore: async (
      key: string,
      min: number | string,
      max: number | string,
    ) => {
      const expired = membersIn(key, min, max);
      for (const member of expired) sortedSets.get(key)?.delete(member);

      return Promise.resolve(expired.length);
    },
    del: async (keys: string | string[]) => {
      const removed = (Array.isArray(keys) ? keys : [keys]).filter(key =>
        store.delete(key),
      );

      return Promise.resolve(removed.length);
    },
    exists: async (key: string) => Promise.resolve(store.has(key) ? 1 : 0),
    get: async (key: string) => Promise.resolve(store.get(key) ?? null),
    mGet: async (keys: string[]) =>
      Promise.resolve(keys.map(key => store.get(key) ?? null)),
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
