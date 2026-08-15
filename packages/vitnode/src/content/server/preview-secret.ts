import { eq } from "drizzle-orm";
import crypto from "node:crypto";

import type { ContentDatabase } from "./service";

import { core_secrets } from "../../database/secrets";

/** The `core_secrets` row the preview signing key lives in. */
export const CONTENT_PREVIEW_SECRET_NAME = "content_preview";

/**
 * How much entropy the preview signing key carries.
 *
 * 32 bytes is the block size HMAC-SHA256 keys are compared against, and it is
 * what `openssl rand -base64 32` produces. Anything shorter is a password, and
 * a password is not a signing key.
 */
const KEY_BYTES = 32;

/**
 * A key nobody has to think about.
 *
 * `randomBytes` rather than anything derived from install data: a signing key
 * must not be reconstructible from a database URL or a hostname, both of which
 * leak far more often than a random row does.
 */
const generate = (): string => crypto.randomBytes(KEY_BYTES).toString("base64");

const read = async (db: ContentDatabase): Promise<string | undefined> => {
  const [row] = await db
    .select({ value: core_secrets.value })
    .from(core_secrets)
    .where(eq(core_secrets.name, CONTENT_PREVIEW_SECRET_NAME))
    .limit(1);

  return row?.value;
};

/**
 * The install's preview key, minting one the first time anybody asks.
 *
 * `onConflictDoNothing` and then a re-read, because two processes booting
 * against the same database both find the row missing and both try to write it.
 * Only one insert can win, and the loser has to end up with the *winner's*
 * value - a loser that kept its own would sign links the other process cannot
 * verify, which is the exact failure this table exists to prevent.
 */
const readOrCreate = async (db: ContentDatabase): Promise<string> => {
  const existing = await read(db);
  if (existing !== undefined) return existing;

  const [inserted] = await db
    .insert(core_secrets)
    .values({ name: CONTENT_PREVIEW_SECRET_NAME, value: generate() })
    .onConflictDoNothing()
    .returning({ value: core_secrets.value });
  if (inserted) return inserted.value;

  const winner = await read(db);
  if (winner !== undefined) return winner;

  throw new Error(
    "Could not read or create the content preview signing secret.",
  );
};

/**
 * The same lookup, run at most once per process.
 *
 * Memoised rather than repeated per request: the row cannot change under a
 * running process without someone deliberately rotating it, and a database
 * round-trip on every preview mint would buy nothing.
 *
 * A failure is not memoised, so a database that was not up yet is retried on
 * the next request instead of poisoning the process.
 */
let cached: Promise<string> | undefined;

export const ensureContentPreviewSecret = async (
  db: ContentDatabase,
): Promise<string> => {
  cached ??= readOrCreate(db).catch((error: unknown) => {
    cached = undefined;
    throw error;
  });

  return await cached;
};

/** Test seam: forgets the memoised secret. */
export const resetContentPreviewSecret = (): void => {
  cached = undefined;
};
