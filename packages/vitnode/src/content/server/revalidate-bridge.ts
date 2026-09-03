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

const originsFor = (c: Context): string[] =>
  c.get("core")?.contentRevalidateOrigins ?? [];

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
