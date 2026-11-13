import type { Context } from "hono";

import { eq } from "drizzle-orm";
import crypto from "node:crypto";

import { createSettledMemo, type SettledMemo } from "@/api/lib/settled-memo";
import { core_secrets } from "@/database/secrets";

type SecretsDatabase = Omit<Context["var"]["db"], "$client">;

const KEY_BYTES = 32;

const generate = (): string => crypto.randomBytes(KEY_BYTES).toString("base64");

const read = async (
  db: SecretsDatabase,
  name: string,
): Promise<string | undefined> => {
  const [row] = await db
    .select({ value: core_secrets.value })
    .from(core_secrets)
    .where(eq(core_secrets.name, name))
    .limit(1);

  return row?.value;
};

const readOrCreate = async (
  db: SecretsDatabase,
  name: string,
): Promise<string> => {
  const existing = await read(db, name);
  if (existing !== undefined) return existing;

  const [inserted] = await db
    .insert(core_secrets)
    .values({ name, value: generate() })
    .onConflictDoNothing()
    .returning({ value: core_secrets.value });
  if (inserted) return inserted.value;

  const winner = await read(db, name);
  if (winner !== undefined) return winner;

  throw new Error(`Could not read or create the "${name}" server secret.`);
};

const cached = new Map<string, SettledMemo<string>>();

export const ensureServerSecret = async (
  db: SecretsDatabase,
  name: string,
): Promise<string> => {
  let memo = cached.get(name);
  if (!memo) {
    memo = createSettledMemo<string>();
    cached.set(name, memo);
  }

  return await memo.get(async () => await readOrCreate(db, name));
};

export const resetServerSecrets = (): void => {
  cached.clear();
};
