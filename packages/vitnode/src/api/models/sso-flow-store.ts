import type { Context } from "hono";

import { and, eq, gt, isNull, lt, lte, or, sql } from "drizzle-orm";

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
  confirmExpiresAt: Date | null;
  confirmHash: null | string;
  confirmSends: number;
  confirmSentAt: Date | null;
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
 * confirmed email. Every `consume*` is a single atomic delete, so a record
 * works once even under concurrent requests.
 */
export interface SsoFlowStore {
  consumeAttempt: (stateHash: string) => Promise<null | SsoAttemptRecord>;
  /**
   * Consumes this browser's pending identity, but only with the live
   * confirmation link most recently emailed for it.
   */
  consumeConfirmed: (args: {
    confirmHash: string;
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
      | "confirmExpiresAt"
      | "confirmHash"
      | "confirmSends"
      | "confirmSentAt"
      | "email"
    >,
    now: Date,
  ) => Promise<void>;
  /**
   * Stores a fresh confirmation link for `email` (replacing any earlier one)
   * and keeps the pending identity alive as long as the link, unless the send
   * cap or cooldown says no.
   */
  setPendingConfirmation: (args: {
    confirmHash: string;
    cooldownMs: number;
    email: string;
    expiresAt: Date;
    maxSends: number;
    now: Date;
    tokenHash: string;
  }) => Promise<boolean>;
}

type Db = Context["var"]["db"];

const toPending = (
  row: typeof core_sso_pending.$inferSelect,
): SsoPendingRecord => ({
  confirmExpiresAt: row.confirmExpiresAt,
  confirmHash: row.confirmHash,
  confirmSends: row.confirmSends,
  confirmSentAt: row.confirmSentAt,
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

  consumeConfirmed: async ({ confirmHash, now, tokenHash }) => {
    const [row] = await db
      .delete(core_sso_pending)
      .where(
        and(
          eq(core_sso_pending.tokenHash, tokenHash),
          eq(core_sso_pending.confirmHash, confirmHash),
          gt(core_sso_pending.confirmExpiresAt, now),
          gt(core_sso_pending.expiresAt, now),
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

  setPendingConfirmation: async ({
    confirmHash,
    cooldownMs,
    email,
    expiresAt,
    maxSends,
    now,
    tokenHash,
  }) => {
    const cooledDown = new Date(now.getTime() - cooldownMs);
    const updated = await db
      .update(core_sso_pending)
      .set({
        confirmExpiresAt: expiresAt,
        confirmHash,
        confirmSends: sql`${core_sso_pending.confirmSends} + 1`,
        confirmSentAt: now,
        email,
        expiresAt,
      })
      .where(
        and(
          eq(core_sso_pending.tokenHash, tokenHash),
          gt(core_sso_pending.expiresAt, now),
          lt(core_sso_pending.confirmSends, maxSends),
          or(
            isNull(core_sso_pending.confirmSentAt),
            lte(core_sso_pending.confirmSentAt, cooledDown),
          ),
        ),
      )
      .returning({ id: core_sso_pending.id });

    return updated.length > 0;
  },
});
