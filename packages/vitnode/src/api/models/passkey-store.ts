import type { Context } from "hono";

import { and, asc, count, eq, gt, inArray, isNull, lte, ne } from "drizzle-orm";

import {
  core_users_passkey_challenges,
  core_users_passkeys,
} from "@/database/passkeys";
import { core_users, core_users_sso } from "@/database/users";

export type PasskeyCeremony =
  "admin_sign_in" | "authentication" | "registration";

export interface PasskeyRecord {
  aaguid: null | string;
  backedUp: boolean;
  counter: number;
  createdAt: Date;
  credentialId: string;
  deviceType: string;
  id: number;
  lastUsedAt: Date | null;
  name: string;
  publicKey: string;
  transports: string[];
  updatedAt: Date;
  userId: number;
  webauthnUserId: string;
}

export type NewPasskey = Omit<
  PasskeyRecord,
  "createdAt" | "id" | "lastUsedAt" | "updatedAt"
>;

export interface PasskeyChallengeRecord {
  ceremony: PasskeyCeremony;
  challenge: string;
  expiresAt: Date;
  tokenHash: string;
  userId: null | number;
  webauthnUserId: null | string;
}

export interface PasskeyRecoveryFacts {
  hasPassword: boolean;
  otherPasskeys: number;
  ssoAccounts: number;
}

export type DeletePasskeyOutcome = "blocked" | "deleted" | "not_found";

export interface PasskeyStore {
  consumeChallenge: (args: {
    ceremony: PasskeyCeremony;
    now: Date;
    tokenHash: string;
    userId: null | number;
  }) => Promise<null | PasskeyChallengeRecord>;
  createPasskey: (values: NewPasskey) => Promise<null | PasskeyRecord>;
  deleteChallenge: (tokenHash: string) => Promise<void>;
  deleteExpiredChallenges: (now: Date) => Promise<void>;
  deletePasskey: (args: {
    canDelete: (facts: PasskeyRecoveryFacts) => boolean;
    id: number;
    ssoProviderIds: string[];
    userId: number;
  }) => Promise<DeletePasskeyOutcome>;
  findPasskeyByCredentialId: (
    credentialId: string,
  ) => Promise<null | PasskeyRecord>;
  listPasskeys: (userId: number) => Promise<PasskeyRecord[]>;
  recordSignIn: (args: {
    backedUp: boolean;
    counter: number;
    deviceType: string;
    id: number;
    previousCounter: number;
    usedAt: Date;
  }) => Promise<boolean>;
  renamePasskey: (args: {
    id: number;
    name: string;
    userId: number;
  }) => Promise<null | PasskeyRecord>;
  saveChallenge: (values: PasskeyChallengeRecord) => Promise<void>;
}

type Db = Context["var"]["db"];

const asChallenge = (
  row: typeof core_users_passkey_challenges.$inferSelect,
  ceremony: PasskeyCeremony,
): PasskeyChallengeRecord => ({
  ceremony,
  challenge: row.challenge,
  expiresAt: row.expiresAt,
  tokenHash: row.tokenHash,
  userId: row.userId,
  webauthnUserId: row.webauthnUserId,
});

export const drizzlePasskeyStore = (db: Db): PasskeyStore => ({
  consumeChallenge: async ({ ceremony, now, tokenHash, userId }) => {
    const [row] = await db
      .delete(core_users_passkey_challenges)
      .where(
        and(
          eq(core_users_passkey_challenges.tokenHash, tokenHash),
          eq(core_users_passkey_challenges.ceremony, ceremony),
          gt(core_users_passkey_challenges.expiresAt, now),
          userId === null
            ? isNull(core_users_passkey_challenges.userId)
            : eq(core_users_passkey_challenges.userId, userId),
        ),
      )
      .returning();

    return row ? asChallenge(row, ceremony) : null;
  },

  createPasskey: async values => {
    const [row] = await db
      .insert(core_users_passkeys)
      .values(values)
      .onConflictDoNothing({ target: core_users_passkeys.credentialId })
      .returning();

    return row ?? null;
  },

  deleteChallenge: async tokenHash => {
    await db
      .delete(core_users_passkey_challenges)
      .where(eq(core_users_passkey_challenges.tokenHash, tokenHash));
  },

  deleteExpiredChallenges: async now => {
    await db
      .delete(core_users_passkey_challenges)
      .where(lte(core_users_passkey_challenges.expiresAt, now));
  },

  deletePasskey: async ({ canDelete, id, ssoProviderIds, userId }) =>
    await db.transaction(async tx => {
      const [user] = await tx
        .select({ password: core_users.password })
        .from(core_users)
        .where(eq(core_users.id, userId))
        .for("update");

      const [passkey] = await tx
        .select({ id: core_users_passkeys.id })
        .from(core_users_passkeys)
        .where(
          and(
            eq(core_users_passkeys.id, id),
            eq(core_users_passkeys.userId, userId),
          ),
        );

      if (!(user && passkey)) return "not_found";

      const [[others], [sso]] = await Promise.all([
        tx
          .select({ value: count() })
          .from(core_users_passkeys)
          .where(
            and(
              eq(core_users_passkeys.userId, userId),
              ne(core_users_passkeys.id, id),
            ),
          ),
        ssoProviderIds.length > 0
          ? tx
              .select({ value: count() })
              .from(core_users_sso)
              .where(
                and(
                  eq(core_users_sso.userId, userId),
                  inArray(core_users_sso.providerId, ssoProviderIds),
                ),
              )
          : [{ value: 0 }],
      ]);

      const allowed = canDelete({
        hasPassword: !!user.password,
        otherPasskeys: others?.value ?? 0,
        ssoAccounts: sso?.value ?? 0,
      });

      if (!allowed) return "blocked";

      await tx
        .delete(core_users_passkeys)
        .where(
          and(
            eq(core_users_passkeys.id, id),
            eq(core_users_passkeys.userId, userId),
          ),
        );

      return "deleted";
    }),

  findPasskeyByCredentialId: async credentialId => {
    const [row] = await db
      .select()
      .from(core_users_passkeys)
      .where(eq(core_users_passkeys.credentialId, credentialId))
      .limit(1);

    return row ?? null;
  },

  listPasskeys: async userId =>
    await db
      .select()
      .from(core_users_passkeys)
      .where(eq(core_users_passkeys.userId, userId))
      .orderBy(asc(core_users_passkeys.createdAt), asc(core_users_passkeys.id)),

  recordSignIn: async ({
    backedUp,
    counter,
    deviceType,
    id,
    previousCounter,
    usedAt,
  }) => {
    const rows = await db
      .update(core_users_passkeys)
      .set({ backedUp, counter, deviceType, lastUsedAt: usedAt })
      .where(
        and(
          eq(core_users_passkeys.id, id),
          eq(core_users_passkeys.counter, previousCounter),
        ),
      )
      .returning({ id: core_users_passkeys.id });

    return rows.length > 0;
  },

  renamePasskey: async ({ id, name, userId }) => {
    const [row] = await db
      .update(core_users_passkeys)
      .set({ name })
      .where(
        and(
          eq(core_users_passkeys.id, id),
          eq(core_users_passkeys.userId, userId),
        ),
      )
      .returning();

    return row ?? null;
  },

  saveChallenge: async values => {
    await db.insert(core_users_passkey_challenges).values(values);
  },
});
