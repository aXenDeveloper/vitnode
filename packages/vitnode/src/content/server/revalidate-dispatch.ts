import type { Context } from "hono";

import type {
  ContentInvalidationInput,
  ContentInvalidationMode,
} from "../cache";

import { CONFIG } from "../../lib/config";
import { contentInvalidationTags } from "../cache";

/** The path a front end mounts if it wants to be told. */
export const CONTENT_REVALIDATE_PATH = "/api/vitnode/content/revalidate";

/** Requests older than this are refused. Replaying one is harmless anyway. */
export const CONTENT_REVALIDATE_MAX_SKEW_MS = 5 * 60 * 1000;

export const CONTENT_REVALIDATE_TIMESTAMP_HEADER = "x-vitnode-timestamp";

/** Two attempts, then give up and let the tag live out its own lifetime. */
const ATTEMPTS = 2;
const RETRY_DELAY_MS = 250;

export interface ContentRevalidationRequest extends ContentInvalidationInput {
  mode: ContentInvalidationMode;
}

const sleep = async (ms: number): Promise<void> =>
  await new Promise(resolve => setTimeout(resolve, ms));

/**
 * Which web origins to notify. Configured, or none.
 *
 * There is deliberately no fallback to the session-cookie origin. Only a front
 * end that caches its own renders has anything to expire, and posting at one
 * that does not is worse than not posting: the request lands on whatever that
 * origin serves at this path - a 404, in an application whose `/api/*` is a
 * Hono mount - which reads as a failed delivery, and
 * `content-schedule-effects` fails the queue task on a partial delivery. Every
 * scheduled publish would then retry its effects forever over a cache that was
 * never there.
 *
 * So the list is opt-in: an install that mounts the handler names its origins,
 * and an install that does not gets `attempted: 0` - "nothing to tell", which
 * is a decision rather than an outage.
 */
const originsFor = (c: Context): string[] =>
  c.get("core")?.contentRevalidateOrigins ?? [];

/**
 * Tells a front end to expire the tags a background mutation just invalidated.
 *
 * This exists because of one hard constraint: **the queue handler does not run
 * in the front end.** It is a plain `@hono/node-server` process, with no access
 * to whatever cache the thing serving the pages keeps. So a scheduled publish
 * cannot expire a render cache by calling a function - it has to ask the
 * process that can, over HTTP, which is why this is a `fetch` and not an import.
 *
 * The alternative was to let each entry expire on its own lifetime, which would
 * leave an unpublished record readable for as long as that lasts. That is not a
 * cache miss; it is the feature not working.
 *
 * Framework-neutral on both sides: the request is a signed POST carrying tag
 * inputs, and what the receiver does with them is its own business. A front end
 * that caches nothing simply does not appear in `content.revalidateOrigins` and
 * is never posted at.
 *
 * **It reports rather than throws.** Every origin is tried, a failure is logged,
 * and the counts come back for the caller to judge. That split matters: one
 * origin being unreachable must not stop the others, but it must also not be
 * hidden - so the decision about whether the delivery was good enough belongs
 * to whoever can retry it, not here.
 *
 * `content-schedule-effects` is that caller, and it requires
 * `delivered === attempted`: with several web apps behind one API, a scheduled
 * unpublish that expired one cache and not the other has left a withdrawn page
 * readable. `attempted: 0` means there was nothing to tell - no tag needed
 * expiring, or no origin is configured - which is not a failure.
 */
export const dispatchContentRevalidation = async (
  c: Context,
  input: ContentRevalidationRequest,
): Promise<{
  /** How many origins were posted to. `0` means there was nothing to tell. */
  attempted: number;
  /** How many accepted it. Anything less than `attempted` is a partial. */
  delivered: number;
}> => {
  if (contentInvalidationTags(input).length === 0) {
    return { attempted: 0, delivered: 0 };
  }

  // Not logged: no configured origin is the default, not a misconfiguration.
  // A front end that wants to be told says so through `content.revalidateOrigins`.
  const origins = originsFor(c);
  if (origins.length === 0) return { attempted: 0, delivered: 0 };

  const secret = c.get("core")?.cronSecret ?? CONFIG.cronJobSecret;
  const body = JSON.stringify(input);
  let delivered = 0;

  // One origin failing must not stop the others: they are separate deployments
  // with separate caches, and a stale page on one is not a reason for a stale
  // page on all of them.
  for (const origin of origins) {
    if (await post(c, origin, body, secret)) delivered += 1;
  }

  return { attempted: origins.length, delivered };
};

const post = async (
  c: Context,
  origin: string,
  body: string,
  secret: string,
): Promise<boolean> => {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(
        new URL(CONTENT_REVALIDATE_PATH, origin).toString(),
        {
          body,
          headers: {
            authorization: `Bearer ${secret}`,
            "content-type": "application/json",
            // Stamped per attempt, so a retry is not refused for being old.
            [CONTENT_REVALIDATE_TIMESTAMP_HEADER]: String(Date.now()),
          },
          method: "POST",
        },
      );

      if (response.ok) return true;

      // A 403 is a misconfigured secret, and retrying will not fix it.
      if (response.status === 403) {
        void log(
          c,
          `${origin} refused the revalidation: the shared secret does not match. Check CRON_SECRET on both sides.`,
        );

        return false;
      }

      void log(c, `${origin} answered ${response.status}.`);
    } catch (error) {
      void log(
        c,
        `${origin} could not be reached: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }

    if (attempt < ATTEMPTS) await sleep(RETRY_DELAY_MS);
  }

  return false;
};

/**
 * Logging is itself best effort: it writes to the database, so it can fail for
 * the same reasons the request did.
 */
const log = async (c: Context, message: string): Promise<void> => {
  const text = `[content-revalidate] ${message}`;

  try {
    await c.get("log")?.error(text);
  } catch {
    // The logger writes to the database, so it can fail for the same reason the
    // request did. The console is the only place left.
    // eslint-disable-next-line no-console
    console.error(text);
  }
};
