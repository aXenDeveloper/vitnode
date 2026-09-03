import { eq } from "drizzle-orm";
import crypto from "node:crypto";

import type { ContentDatabase } from "./service";

import { core_secrets } from "../../database/secrets";

/** The `core_secrets` row the preview signing key lives in. */
export const CONTENT_PREVIEW_SECRET_NAME = "content_preview";

const KEY_BYTES = 32;

const generate = (): string => crypto.randomBytes(KEY_BYTES).toString("base64");

const read = async (db: ContentDatabase): Promise<string | undefined> => {
  const [row] = await db
    .select({ value: core_secrets.value })
    .from(core_secrets)
    .where(eq(core_secrets.name, CONTENT_PREVIEW_SECRET_NAME))
    .limit(1);

  return row?.value;
};

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
