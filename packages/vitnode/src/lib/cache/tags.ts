import { cacheRedisRead, cacheRedisWrite, NEXT_CACHE_PREFIX } from "./client";

/**
 * When a tag was last marked stale or expired, in milliseconds.
 *
 * The same two fields Next keeps in its in-process tags manifest, with the same
 * meanings, because both handlers reproduce Next's own comparisons against them
 * and any drift here would show up as a page that refuses to expire.
 */
export interface TagState {
  /** Revalidated at this timestamp - entries older than it are gone. */
  expired?: number;
  /** Marked stale at this timestamp - entries older than it get revalidated. */
  stale?: number;
}

/**
 * How long a revalidation marker is kept.
 *
 * A marker has to outlive every cache entry that could still be carrying the
 * tag, or that entry comes back from the dead. 30 days is the `revalidate` of
 * Next's longest built-in profile (`max`), so an entry that outlives its marker
 * has already been forced to refresh on age alone.
 */
const TAG_RETENTION_SECONDS = 60 * 60 * 24 * 30;

/**
 * One key per tag rather than one manifest hash.
 *
 * A single hash would grow for the lifetime of the deployment - every tag ever
 * revalidated, kept forever because a hash field cannot carry its own TTL - and
 * every read would have to fetch the whole thing. Separate keys expire on their
 * own and let a lookup ask for exactly the tags on the entry in hand.
 */
const tagKey = (tag: string): string => `${NEXT_CACHE_PREFIX}tag:${tag}`;

/** Reads the revalidation state of several tags in one round-trip. */
export const readTagStates = async (
  tags: readonly string[],
): Promise<Map<string, TagState>> => {
  const states = new Map<string, TagState>();
  if (tags.length === 0) return states;

  const raw = await cacheRedisRead<(null | string)[]>(
    async client => await client.mGet(tags.map(tagKey)),
    [],
  );

  tags.forEach((tag, index) => {
    const value = raw[index];
    if (value == null) return;

    try {
      states.set(tag, JSON.parse(value) as TagState);
    } catch {
      /* a corrupt marker is treated as "never revalidated" */
    }
  });

  return states;
};

/**
 * Records a revalidation, visible to every instance.
 *
 * `durations.expire` is Next's stale-while-revalidate form: the tag goes stale
 * now and hard-expires later, so the old response may be served while a new one
 * is built. Without it the tag expires immediately, which is what a delete or an
 * unpublish needs.
 */
export const writeTagStates = async (
  tags: readonly string[],
  durations?: { expire?: number },
): Promise<void> => {
  if (tags.length === 0) return;

  const now = Date.now();
  const state: TagState = durations
    ? {
        stale: now,
        ...(durations.expire === undefined
          ? {}
          : { expired: now + durations.expire * 1000 }),
      }
    : { expired: now };

  // The marker has to outlive a future-dated expiry as well as any entry
  // carrying the tag, so a long `expire` extends the retention rather than
  // being silently truncated by it.
  const ttl = Math.max(
    TAG_RETENTION_SECONDS,
    durations?.expire === undefined ? 0 : Math.ceil(durations.expire) + 60,
  );

  await cacheRedisWrite(async client => {
    await Promise.all(
      tags.map(
        async tag =>
          await client.set(tagKey(tag), JSON.stringify(state), {
            expiration: { type: "EX", value: ttl },
          }),
      ),
    );
  });
};

/**
 * Whether any tag was revalidated after the entry was written.
 *
 * A transcription of Next's `areTagsExpired`, including the part that looks odd
 * on first reading: a marker dated in the future (`expire` was given) does not
 * expire anything until that moment arrives, which is what lets the old response
 * keep being served in the meantime.
 */
export const areTagsExpired = (
  states: Map<string, TagState>,
  tags: readonly string[],
  timestamp: number,
): boolean => {
  const now = Date.now();

  return tags.some(tag => {
    const expiredAt = states.get(tag)?.expired;

    return (
      typeof expiredAt === "number" && expiredAt <= now && expiredAt > timestamp
    );
  });
};

/** Whether any tag was marked stale after the entry was written. */
export const areTagsStale = (
  states: Map<string, TagState>,
  tags: readonly string[],
  timestamp: number,
): boolean =>
  tags.some(tag => {
    const staleAt = states.get(tag)?.stale ?? 0;

    return staleAt > timestamp;
  });

/**
 * The most recent revalidation across a set of tags, or `0` for none.
 *
 * What Next's `getExpiration` contract asks for: it compares the result with an
 * entry's timestamp to decide whether a request's implicit tags have outdated it.
 */
export const latestTagExpiration = (
  states: Map<string, TagState>,
  tags: readonly string[],
): number =>
  tags.reduce(
    (latest, tag) => Math.max(latest, states.get(tag)?.expired ?? 0),
    0,
  );
