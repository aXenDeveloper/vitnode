import type { Context } from "hono";

import type {
  ContentInvalidationInput,
  ContentInvalidationMode,
} from "../cache";

import { CONFIG } from "../../lib/config";
import { contentInvalidationTags } from "../cache";

/** Where the Route Handler is mounted in every VitNode web app. */
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
 * Which web origins to notify.
 *
 * Defaults to the one origin every install already configures for its session
 * cookie and CORS. An install that serves several web apps from one API
 * overrides it, and each is posted independently.
 */
const originsFor = (c: Context): string[] => {
  const configured = c.get("core")?.contentRevalidateOrigins;
  if (configured && configured.length > 0) return configured;

  try {
    // `CONFIG.web` builds a `URL`, which throws on an empty or malformed
    // `NEXT_PUBLIC_WEB_URL`. A bad env var must degrade to "nowhere to tell"
    // and a log line - never take the queue task down with it.
    return [CONFIG.web.origin];
  } catch {
    return [];
  }
};

/**
 * Tells the web app to expire the tags a background mutation just invalidated.
 *
 * This exists because of one hard constraint: **the queue handler does not run
 * in Next.** In the split deployment it is a plain `@hono/node-server` process
 * where importing `next/cache` throws outright, and in the single-app
 * deployment it is a Route Handler where `updateTag` is unavailable. So a
 * scheduled publish cannot expire a cache tag by calling a function - it has to
 * ask the process that can.
 *
 * The alternative was to let the tag expire on its own `cacheLife`, which would
 * leave an unpublished record readable for as long as that lasts. That is not a
 * cache miss; it is the feature not working.
 *
 * **Best effort, deliberately.** A failure is logged and swallowed, exactly
 * like `syncContentSearch`. Throwing would fail the queue task, and the retry
 * would re-run the *publish* - which is idempotent, so the second run would
 * find nothing changed and skip the invalidation entirely. Strictly worse than
 * a stale page.
 */
export const dispatchContentRevalidation = async (
  c: Context,
  input: ContentRevalidationRequest,
): Promise<{ attempted: number; delivered: number }> => {
  if (contentInvalidationTags(input).length === 0) {
    return { attempted: 0, delivered: 0 };
  }

  const origins = originsFor(c);
  if (origins.length === 0) {
    void log(
      c,
      "No web origin is configured, so nothing was told to expire its cache. Set NEXT_PUBLIC_WEB_URL, or content.revalidateOrigins for a multi-app install.",
    );

    return { attempted: 0, delivered: 0 };
  }

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
