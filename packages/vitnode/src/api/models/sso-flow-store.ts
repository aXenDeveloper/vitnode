import type { Context } from "hono";

import { and, eq, gt, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";

import { core_sso_attempts, core_sso_pending } from "@/database/users";

import type { SsoProfileValues } from "./sso-connection-store";

export interface SsoAttemptRecord {
  bindingHash: string;
  codeVerifier: string;
  expiresAt: Date;
  nonce: string;
  providerId: string;
  stateHash: string;
}

export interface SsoPendingRecord {
  codeAttempts: number;
  codeExpiresAt: Date | null;
  codeHash: null | string;
  codeSends: number;
  codeSentAt: Date | null;
  email: null | string;
  expiresAt: Date;
  profile: null | SsoProfileValues;
  providerAccountId: string;
  providerId: string;
  providerUsername: null | string;
  tokenHash: string;
}

/**
 * Server-side state of a sign-in round trip and of an identity waiting for a
 * confirmed email. Every `consume*`/`take*` is a single atomic delete, so a
 * record works once even under concurrent requests.
 */
export interface SsoFlowStore {
  consumeAttempt: (stateHash: string) => Promise<null | SsoAttemptRecord>;
  consumePending: (args: {
    now: Date;
    tokenHash: string;
  }) => Promise<null | SsoPendingRecord>;
  /** Counts one code guess, if the code is live and `maxAttempts` is not spent. */
  countCodeAttempt: (args: {
    maxAttempts: number;
    now: Date;
    tokenHash: string;
  }) => Promise<null | SsoPendingRecord>;
  findPending: (args: {
    now: Date;
    tokenHash: string;
  }) => Promise<null | SsoPendingRecord>;
  saveAttempt: (record: SsoAttemptRecord, now: Date) => Promise<void>;
  savePending: (
    record: Omit<
      SsoPendingRecord,
      | "codeAttempts"
      | "codeExpiresAt"
      | "codeHash"
      | "codeSends"
      | "codeSentAt"
      | "email"
    >,
    now: Date,
  ) => Promise<void>;
  /** Stores a fresh code for `email`, unless the send cap or cooldown says no. */
  setPendingCode: (args: {
    codeExpiresAt: Date;
    codeHash: string;
    cooldownMs: number;
    email: string;
    maxSends: number;
    now: Date;
    tokenHash: string;
  }) => Promise<boolean>;
}

type Db = Context["var"]["db"];

const toPending = (
  row: typeof core_sso_pending.$inferSelect,
): SsoPendingRecord => ({
  codeAttempts: row.codeAttempts,
  codeExpiresAt: row.codeExpiresAt,
  codeHash: row.codeHash,
  codeSends: row.codeSends,
  codeSentAt: row.codeSentAt,
  email: row.email,
  expiresAt: row.expiresAt,
  profile: row.profile ?? null,
  providerAccountId: row.providerAccountId,
  providerId: row.providerId,
  providerUsername: row.providerUsername,
  tokenHash: row.tokenHash,
});

export const drizzleSsoFlowStore = (db: Db): SsoFlowStore => ({
  consumeAttempt: async stateHash => {
    const [row] = await db
      .delete(core_sso_attempts)
      .where(eq(core_sso_attempts.stateHash, stateHash))
      .returning();

    return row
      ? {
          bindingHash: row.bindingHash,
          codeVerifier: row.codeVerifier,
          expiresAt: row.expiresAt,
          nonce: row.nonce,
          providerId: row.providerId,
          stateHash: row.stateHash,
        }
      : null;
  },

  consumePending: async ({ now, tokenHash }) => {
    const [row] = await db
      .delete(core_sso_pending)
      .where(
        and(
          eq(core_sso_pending.tokenHash, tokenHash),
          gt(core_sso_pending.expiresAt, now),
        ),
      )
      .returning();

    return row ? toPending(row) : null;
  },

  countCodeAttempt: async ({ maxAttempts, now, tokenHash }) => {
    const [row] = await db
      .update(core_sso_pending)
      .set({ codeAttempts: sql`${core_sso_pending.codeAttempts} + 1` })
      .where(
        and(
          eq(core_sso_pending.tokenHash, tokenHash),
          gt(core_sso_pending.expiresAt, now),
          isNotNull(core_sso_pending.codeHash),
          gt(core_sso_pending.codeExpiresAt, now),
          lt(core_sso_pending.codeAttempts, maxAttempts),
        ),
      )
      .returning();

    return row ? toPending(row) : null;
  },

  findPending: async ({ now, tokenHash }) => {
    const [row] = await db
      .select()
      .from(core_sso_pending)
      .where(
        and(
          eq(core_sso_pending.tokenHash, tokenHash),
          gt(core_sso_pending.expiresAt, now),
        ),
      )
      .limit(1);

    return row ? toPending(row) : null;
  },

  saveAttempt: async (record, now) => {
    await db
      .delete(core_sso_attempts)
      .where(lte(core_sso_attempts.expiresAt, now));
    await db.insert(core_sso_attempts).values(record);
  },

  savePending: async (record, now) => {
    await db
      .delete(core_sso_pending)
      .where(lte(core_sso_pending.expiresAt, now));
    await db.insert(core_sso_pending).values(record);
  },

  setPendingCode: async ({
    codeExpiresAt,
    codeHash,
    cooldownMs,
    email,
    maxSends,
    now,
    tokenHash,
  }) => {
    const cooledDown = new Date(now.getTime() - cooldownMs);
    const updated = await db
      .update(core_sso_pending)
      .set({
        codeAttempts: 0,
        codeExpiresAt,
        codeHash,
        codeSends: sql`${core_sso_pending.codeSends} + 1`,
        codeSentAt: now,
        email,
      })
      .where(
        and(
          eq(core_sso_pending.tokenHash, tokenHash),
          gt(core_sso_pending.expiresAt, now),
          lt(core_sso_pending.codeSends, maxSends),
          or(
            isNull(core_sso_pending.codeSentAt),
            lte(core_sso_pending.codeSentAt, cooledDown),
          ),
        ),
      )
      .returning({ id: core_sso_pending.id });

    return updated.length > 0;
  },
});
