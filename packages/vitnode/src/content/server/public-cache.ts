import type { Context } from "hono";

import { createHash, randomUUID } from "node:crypto";

import type { CacheModel } from "../../api/lib/cache";

/**
 * How long one cached public read lives. Only a safety net: a write moves the
 * content type's generation, which orphans every entry at once.
 */
export const CONTENT_PUBLIC_CACHE_TTL_SECONDS = 60;

/** JSON with sorted object keys, so `{a, b}` and `{b, a}` hash the same. */
const stableJson = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) =>
    item !== null && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item as Record<string, unknown>).toSorted(
            ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
          ),
        )
      : item,
  );

/**
 * Reads a generation stamp, or `"0"` when none was written yet.
 *
 * In the system namespace, because the code that moves it - a scheduled
 * publish, a write from another plugin's route - does not always run with the
 * owning plugin on the context, and a plugin-scoped key would then be a
 * different key.
 */
const readGeneration = async (
  cache: CacheModel,
  key: string,
): Promise<string> => (await cache.getSystem<string>(key)) ?? "0";

/**
 * Moves a generation stamp. A random id rather than a counter or a timestamp:
 * two instances with skewed clocks could otherwise write a stamp that points
 * readers back at a generation whose entries are still alive.
 */
const bumpGeneration = async (c: Context, key: string): Promise<void> => {
  const cache: CacheModel | undefined = c.get("cache");
  await cache?.setSystem(key, randomUUID());
};

const inflight = new Map<string, Promise<unknown>>();

/**
 * A generation-keyed read-through: `<prefix>:g<generation>:<sha256(key)>`.
 *
 * Concurrent misses for the same key in one process share one load, and the
 * value is wrapped so a cached `null` is a hit rather than a miss.
 */
const rememberInGeneration = async <T>(
  c: Context,
  {
    generationKey,
    key,
    load,
    prefix,
    ttlSeconds,
  }: {
    generationKey: string;
    key: unknown;
    load: () => Promise<T>;
    prefix: string;
    ttlSeconds: number;
  },
): Promise<T> => {
  // Tests often build a context without one.
  const cache: CacheModel | undefined = c.get("cache");
  if (!cache) return await load();

  const generation = await readGeneration(cache, generationKey);
  const fullKey = `${prefix}:g${generation}:${createHash("sha256")
    .update(stableJson(key))
    .digest("base64url")}`;

  const hit = await cache.getSystem<{ value: T }>(fullKey);
  if (hit) return hit.value;

  const pending = inflight.get(fullKey) as Promise<T> | undefined;
  if (pending) return await pending;

  const loading = (async () => {
    const value = await load();
    await cache.setSystem(fullKey, { value }, ttlSeconds);

    return value;
  })();
  inflight.set(fullKey, loading);

  try {
    return await loading;
  } finally {
    inflight.delete(fullKey);
  }
};

const publicGenerationKey = (contentTypeId: string): string =>
  `content:gen:${contentTypeId}`;

/**
 * Expires every cached public read of one content type - list, detail, every
 * locale - in a single write.
 *
 * Call it **after** the write commits: a reader that slips in between a bump and
 * a commit would read the old row and store it under the new generation.
 */
export const bumpContentPublicGeneration = async (
  c: Context,
  contentTypeId: string,
): Promise<void> => {
  await bumpGeneration(c, publicGenerationKey(contentTypeId));
};

/**
 * One cached public read. `key` must hold everything the response depends on -
 * the normalized query, the resolved locale and where it came from - and the
 * response must not depend on who is asking: never wrap a read that can return
 * hidden content, a preview or anything else per viewer.
 */
export const rememberContentPublicRead = async <T>(
  c: Context,
  {
    contentTypeId,
    key,
    load,
  }: { contentTypeId: string; key: unknown; load: () => Promise<T> },
): Promise<T> =>
  await rememberInGeneration(c, {
    generationKey: publicGenerationKey(contentTypeId),
    key,
    load,
    prefix: `content:pub:${contentTypeId}`,
    ttlSeconds: CONTENT_PUBLIC_CACHE_TTL_SECONDS,
  });

/** Container trees change through the AdminCP only, and each write bumps. */
const CONTENT_CONTAINER_TREE_TTL_SECONDS = 300;

const containerGenerationKey = (definitionId: string): string =>
  `content:containers:gen:${definitionId}`;

/** Expires one container collection's cached tree. After the write commits. */
export const bumpContentContainerGeneration = async (
  c: Context,
  definitionId: string,
): Promise<void> => {
  await bumpGeneration(c, containerGenerationKey(definitionId));
};

/** One container collection's `{ id, parentId }` tree, cached per generation. */
export const rememberContentContainerTree = async <T>(
  c: Context,
  definitionId: string,
  load: () => Promise<T>,
): Promise<T> =>
  await rememberInGeneration(c, {
    generationKey: containerGenerationKey(definitionId),
    key: "tree",
    load,
    prefix: `content:containers:${definitionId}`,
    ttlSeconds: CONTENT_CONTAINER_TREE_TTL_SECONDS,
  });
