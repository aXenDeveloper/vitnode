import type { z } from "zod";

import type { JsonWireInputCheck } from "./json-wire";

/** One part of a typed cache entry's key. Strings and numbers never collide: `"1"` and `1` are different keys. */
export type CacheKeyPart = boolean | number | string;

/**
 * A typed cache entry: what `defineCacheEntry` returns, and what
 * `c.get("cache").entry(definition, ...keyArgs)` reads and writes.
 */
export interface CacheEntryDefinition<
  Plugin extends string = string,
  Name extends string = string,
  Args extends readonly unknown[] = readonly unknown[],
  Schema extends z.ZodType = z.ZodType,
> {
  /** Turns the arguments of `entry(definition, ...args)` into the key's parts. */
  readonly key: (...args: Args) => readonly CacheKeyPart[];
  readonly name: Name;
  readonly pluginId: Plugin;
  readonly schema: Schema;
  readonly ttlSeconds: number;
  readonly version: number;
}

export interface CacheEntryOptions<
  Plugin extends string,
  Name extends string,
  Args extends readonly unknown[],
  Schema extends z.ZodType,
> {
  /**
   * Maps the entry's arguments to key parts: `(forumId: number) => [forumId]`.
   * Omit it for an entry with a single key. At most 8 parts; each a string
   * of up to 256 characters, a finite number or a boolean.
   */
  key?: (...args: Args) => readonly CacheKeyPart[];
  /** Unique within the plugin: letters, digits, `.`, `_` and `-`, up to 100 characters. */
  name: Name;
  /** The owning plugin's id. `bindApiPlugin(manifest).defineCacheEntry` fills it in. */
  pluginId: Plugin;
  /**
   * Validates every write and every read. Its input must be JSON, because
   * values are stored as JSON; a stored value it rejects is a miss.
   */
  schema: JsonWireInputCheck<Schema> & Schema;
  /** Seconds an entry lives. A whole number, at least 1. The in-memory fallback caps it at 15. */
  ttlSeconds: number;
  /**
   * Bump it to drop every stored entry at once - when the stored shape or
   * its meaning changes. Never derived from the schema. A whole number, at least 1.
   */
  version: number;
}

export const CACHE_ENTRY_PREFIX = "vitnode:cache-entry:";
const NAME = /^[A-Za-z0-9][\w.-]{0,99}$/;
const MAX_KEY_PARTS = 8;
const MAX_KEY_PART_LENGTH = 256;

/**
 * Thrown by `defineCacheEntry` for an invalid name, version or TTL, and by
 * `entry()` for a key part that is not a short string, a finite number or a
 * boolean. A programming error, so it is not swallowed like a Redis failure.
 */
export class CacheEntryDefinitionError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = "CacheEntryDefinitionError";
  }
}

/**
 * Thrown by `set()` and `remember()` when the value is not JSON or the schema
 * rejects it. Nothing was stored. The message names paths and issue codes,
 * never values.
 */
export class CacheEntryValidationError extends Error {
  constructor(entry: string, reason: string) {
    super(`Cache entry "${entry}" was not stored: invalid value - ${reason}`);
    this.name = "CacheEntryValidationError";
    this.entry = entry;
    this.reason = reason;
  }

  readonly entry: string;
  readonly reason: string;
}

/**
 * Declares a typed server-side cache entry: its name, version, key parts,
 * value schema and TTL. Read and write it with
 * `c.get("cache").entry(definition, ...keyArgs)`.
 *
 * Use the plugin-bound `defineCacheEntry` from your `src/api/builders.ts`,
 * which fills in `pluginId`. Entries are stored under the defining plugin
 * whichever route reads them. Universal, but only the API reads the cache.
 *
 * @throws {CacheEntryDefinitionError} For an invalid `name`, `version` or `ttlSeconds`.
 *
 * @example
 * ```ts
 * import { z } from "zod";
 *
 * import { defineCacheEntry } from "@/api/builders";
 *
 * export const forumStatsCache = defineCacheEntry({
 *   name: "forum-stats",
 *   version: 1,
 *   key: (forumId: number) => [forumId],
 *   schema: z.object({ topics: z.number().int(), comments: z.number().int() }),
 *   ttlSeconds: 300,
 * });
 *
 * const stats = await c
 *   .get("cache")
 *   .entry(forumStatsCache, forumId)
 *   .remember(async () => await countForumStats(c, forumId));
 * ```
 */
export const defineCacheEntry = <
  const Plugin extends string,
  const Name extends string,
  Schema extends z.ZodType,
  const Args extends readonly unknown[] = [],
>({
  key,
  name,
  pluginId,
  schema,
  ttlSeconds,
  version,
}: CacheEntryOptions<Plugin, Name, Args, Schema>): CacheEntryDefinition<
  Plugin,
  Name,
  Args,
  Schema
> => {
  const label = `${pluginId}:${name}`;
  if (!NAME.test(name)) {
    throw new CacheEntryDefinitionError(
      `Cache entry "${label}": the name may only use letters, digits, ".", "_" and "-" (up to 100 characters).`,
    );
  }
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new CacheEntryDefinitionError(
      `Cache entry "${label}": version must be a whole number of at least 1.`,
    );
  }
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1) {
    throw new CacheEntryDefinitionError(
      `Cache entry "${label}": ttlSeconds must be a whole number of at least 1.`,
    );
  }

  return Object.freeze({
    key: key ?? (() => []),
    name,
    pluginId,
    schema,
    ttlSeconds,
    version,
  });
};

/**
 * The storage key of one entry: plugin, name and version, then the key parts
 * as a JSON array, which keeps `"1"` and `1` apart. Lives outside the system
 * store (`vitnode:cache:__system__:…`), so no entry can collide with it.
 *
 * @throws {CacheEntryDefinitionError} For an unsupported key part.
 */
export const cacheEntryKey = (
  definition: Pick<CacheEntryDefinition, "name" | "pluginId" | "version">,
  parts: readonly unknown[],
): string => {
  const label = `${definition.pluginId}:${definition.name}`;
  if (parts.length > MAX_KEY_PARTS) {
    throw new CacheEntryDefinitionError(
      `Cache entry "${label}": a key has at most ${String(MAX_KEY_PARTS)} parts, got ${String(parts.length)}.`,
    );
  }
  parts.forEach((part, index) => {
    const valid =
      typeof part === "boolean" ||
      (typeof part === "number" && Number.isFinite(part)) ||
      (typeof part === "string" && part.length <= MAX_KEY_PART_LENGTH);
    if (!valid) {
      throw new CacheEntryDefinitionError(
        `Cache entry "${label}": key part ${String(index)} must be a string of up to ${String(MAX_KEY_PART_LENGTH)} characters, a finite number or a boolean.`,
      );
    }
  });

  return `${cacheEntryPrefix(definition.pluginId)}${definition.name}:v${String(definition.version)}:${JSON.stringify(parts)}`;
};

/** Where a plugin's typed entries live, for `flush()`. */
export const cacheEntryPrefix = (pluginId: string): string =>
  `${CACHE_ENTRY_PREFIX}${pluginId}:`;
