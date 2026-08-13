import { eq } from "drizzle-orm";
import crypto from "node:crypto";

import type { ContentDatabase } from "./service";

import { core_secrets } from "../../database/secrets";
import {
  CONTENT_PREVIEW_SECRET_MIN_BYTES,
  isSecureContentPreviewSecret,
} from "../../lib/config";

/** The `core_secrets` row the preview signing key lives in. */
export const CONTENT_PREVIEW_SECRET_NAME = "content_preview";

/**
 * A key nobody has to think about.
 *
 * `randomBytes` rather than anything derived from install data: a signing key
 * must not be reconstructible from a database URL or a hostname, both of which
 * leak far more often than a random row does.
 */
const generate = (): string =>
  crypto.randomBytes(CONTENT_PREVIEW_SECRET_MIN_BYTES).toString("base64");

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
 * `CONTENT_PREVIEW_SECRET` when it is usable, the generated key otherwise.
 *
 * The variable is an **override**, not a requirement. It is worth keeping for
 * the two things a generated key cannot do - rotating every outstanding link by
 * changing one value, and sharing a key between deployments that do not share a
 * database - and worth ignoring when it is too short to be a signing key, since
 * the alternative is signing with a password and calling it secure.
 *
 * Ignoring it is loud. Silently substituting a different key than the one an
 * operator deliberately set would make a rotation look like it worked.
 */
const resolve = async (db: ContentDatabase): Promise<string> => {
  const override = process.env.CONTENT_PREVIEW_SECRET;

  if (override !== undefined && override !== "") {
    if (isSecureContentPreviewSecret(override)) return override;

    // eslint-disable-next-line no-console
    console.warn(
      `[Content Engine] CONTENT_PREVIEW_SECRET is set but shorter than ${CONTENT_PREVIEW_SECRET_MIN_BYTES} bytes, so it is ignored and the install's generated signing key is used instead. Generate a real one with \`openssl rand -base64 32\`, or unset the variable.`,
    );
  }

  return await readOrCreate(db);
};

/**
 * The same resolution, run at most once per process.
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
  cached ??= resolve(db).catch((error: unknown) => {
    cached = undefined;
    throw error;
  });

  return await cached;
};

/** Test seam: forgets the memoised secret. */
export const resetContentPreviewSecret = (): void => {
  cached = undefined;
};
