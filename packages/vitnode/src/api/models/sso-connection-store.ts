import type { Context } from "hono";

import { and, asc, count, eq, gt, inArray, lte, ne } from "drizzle-orm";

import type { SsoOperationIntent, SsoProfileField } from "@/lib/sso-profile";

import { isForeignKeyViolation, isUniqueViolation } from "@/api/lib/db-errors";
import { core_users_passkeys } from "@/database/passkeys";
import {
  core_users,
  core_users_sso,
  core_users_sso_operations,
  core_users_sso_profile_sources,
} from "@/database/users";
import { SSO_PROFILE_FIELDS } from "@/lib/sso-profile";

export interface SsoConnectionRecord {
  avatarFileId: null | number;
  avatarSha256: null | string;
  avatarSourceUrl: null | string;
  createdAt: Date;
  providerAccountId: string;
  providerEmail: null | string;
  providerId: string;
  providerUsername: null | string;
  syncOnSignIn: boolean;
  userId: number;
}

export interface SsoProfileSourceRecord {
  field: SsoProfileField;
  providerId: string;
}

export interface SsoProfileValues {
  avatarUrl: null | string;
  firstName: null | string;
  lastName: null | string;
}

export interface SsoOperationRecord {
  expiresAt: Date;
  fields: SsoProfileField[];
  intent: SsoOperationIntent;
  preview: null | SsoProfileValues;
  providerAccountId: null | string;
  providerId: string;
  tokenHash: null | string;
  userId: number;
}

export interface SsoSignInFacts {
  hasPassword: boolean;
  otherSsoProviderIds: string[];
  passkeys: number;
}

export interface SsoAccountProfile {
  avatarId: null | number;
  email: string;
  firstName: null | string;
  id: number;
  lastName: null | string;
  name: string;
  roleId: number;
}

export type SsoLinkOutcome =
  "already_linked" | "linked" | "provider_in_use" | "taken";

export type SsoDisconnectOutcome = "blocked" | "disconnected" | "not_found";

export type SsoPreferencesOutcome = "not_connected" | "saved";

export interface SsoPreferencesChange {
  sources: Partial<Record<SsoProfileField, null | string>>;
  sync: Record<string, boolean>;
  userId: number;
}

export interface SsoConnectionStore {
  clearSources: (args: {
    fields: SsoProfileField[];
    userId: number;
  }) => Promise<SsoProfileField[]>;
  consumeOperation: (tokenHash: string) => Promise<null | SsoOperationRecord>;
  deleteExpiredOperations: (now: Date) => Promise<void>;
  disconnect: (args: {
    canDisconnect: (facts: SsoSignInFacts) => boolean;
    providerId: string;
    userId: number;
  }) => Promise<SsoDisconnectOutcome>;
  findConnection: (args: {
    providerId: string;
    userId: number;
  }) => Promise<null | SsoConnectionRecord>;
  findPreview: (args: {
    now: Date;
    providerId: string;
    userId: number;
  }) => Promise<null | SsoOperationRecord>;
  link: (values: {
    providerAccountId: string;
    providerEmail: null | string;
    providerId: string;
    providerUsername: null | string;
    userId: number;
  }) => Promise<SsoLinkOutcome>;
  listConnections: (userId: number) => Promise<SsoConnectionRecord[]>;
  listSources: (userId: number) => Promise<SsoProfileSourceRecord[]>;
  readAccount: (userId: number) => Promise<null | SsoAccountProfile>;
  recordAvatar: (args: {
    fileId: number;
    providerId: string;
    sha256: string;
    sourceUrl: string;
    userId: number;
  }) => Promise<void>;
  recordSignIn: (args: {
    providerEmail: null | string;
    providerId: string;
    providerUsername: null | string;
    userId: number;
  }) => Promise<void>;
  saveOperation: (values: SsoOperationRecord) => Promise<void>;
  savePreferences: (
    change: SsoPreferencesChange,
  ) => Promise<SsoPreferencesOutcome>;
  savePreview: (values: SsoOperationRecord) => Promise<void>;
  signInFacts: (
    userId: number,
  ) => Promise<Omit<SsoSignInFacts, "otherSsoProviderIds">>;
  takePreview: (args: {
    now: Date;
    providerId: string;
    userId: number;
  }) => Promise<null | SsoOperationRecord>;
  writeNames: (args: {
    userId: number;
    values: Partial<Pick<SsoProfileValues, "firstName" | "lastName">>;
  }) => Promise<void>;
}

type Db = Context["var"]["db"];

const toOperation = (
  row: typeof core_users_sso_operations.$inferSelect,
): SsoOperationRecord => ({
  expiresAt: row.expiresAt,
  fields: row.fields,
  intent: row.intent,
  preview: row.preview,
  providerAccountId: row.providerAccountId,
  providerId: row.providerId,
  tokenHash: row.tokenHash,
  userId: row.userId,
});

const connectionColumns = {
  avatarFileId: core_users_sso.avatarFileId,
  avatarSha256: core_users_sso.avatarSha256,
  avatarSourceUrl: core_users_sso.avatarSourceUrl,
  createdAt: core_users_sso.createdAt,
  providerAccountId: core_users_sso.providerAccountId,
  providerEmail: core_users_sso.providerEmail,
  providerId: core_users_sso.providerId,
  providerUsername: core_users_sso.providerUsername,
  syncOnSignIn: core_users_sso.syncOnSignIn,
  userId: core_users_sso.userId,
};

const previewOf = (userId: number, providerId: string, now: Date) =>
  and(
    eq(core_users_sso_operations.userId, userId),
    eq(core_users_sso_operations.providerId, providerId),
    eq(core_users_sso_operations.intent, "preview"),
    gt(core_users_sso_operations.expiresAt, now),
  );

const accountOwner = async (
  db: Pick<Db, "select">,
  {
    providerAccountId,
    providerId,
  }: { providerAccountId: string; providerId: string },
): Promise<null | number> => {
  const [owner] = await db
    .select({ userId: core_users_sso.userId })
    .from(core_users_sso)
    .where(
      and(
        eq(core_users_sso.providerId, providerId),
        eq(core_users_sso.providerAccountId, providerAccountId),
      ),
    )
    .limit(1);

  return owner?.userId ?? null;
};

const ownershipOutcome = (
  ownerId: number,
  userId: number,
): Extract<SsoLinkOutcome, "already_linked" | "taken"> =>
  ownerId === userId ? "already_linked" : "taken";

export const drizzleSsoConnectionStore = (db: Db): SsoConnectionStore => ({
  clearSources: async ({ fields, userId }) => {
    if (fields.length === 0) return [];

    const rows = await db
      .delete(core_users_sso_profile_sources)
      .where(
        and(
          eq(core_users_sso_profile_sources.userId, userId),
          inArray(core_users_sso_profile_sources.field, fields),
        ),
      )
      .returning({ field: core_users_sso_profile_sources.field });

    return rows.map(row => row.field);
  },

  consumeOperation: async tokenHash => {
    const [row] = await db
      .delete(core_users_sso_operations)
      .where(eq(core_users_sso_operations.tokenHash, tokenHash))
      .returning();

    return row ? toOperation(row) : null;
  },

  deleteExpiredOperations: async now => {
    await db
      .delete(core_users_sso_operations)
      .where(lte(core_users_sso_operations.expiresAt, now));
  },

  disconnect: async ({ canDisconnect, providerId, userId }) =>
    await db.transaction(async tx => {
      const [user] = await tx
        .select({ password: core_users.password })
        .from(core_users)
        .where(eq(core_users.id, userId))
        .for("update");

      const [connection] = await tx
        .select({ providerId: core_users_sso.providerId })
        .from(core_users_sso)
        .where(
          and(
            eq(core_users_sso.userId, userId),
            eq(core_users_sso.providerId, providerId),
          ),
        );

      if (!(user && connection)) return "not_found";

      const [[passkeys], others] = await Promise.all([
        tx
          .select({ value: count() })
          .from(core_users_passkeys)
          .where(eq(core_users_passkeys.userId, userId)),
        tx
          .select({ providerId: core_users_sso.providerId })
          .from(core_users_sso)
          .where(
            and(
              eq(core_users_sso.userId, userId),
              ne(core_users_sso.providerId, providerId),
            ),
          ),
      ]);

      const allowed = canDisconnect({
        hasPassword: !!user.password,
        otherSsoProviderIds: others.map(row => row.providerId),
        passkeys: passkeys?.value ?? 0,
      });

      if (!allowed) return "blocked";

      await tx
        .delete(core_users_sso_operations)
        .where(
          and(
            eq(core_users_sso_operations.userId, userId),
            eq(core_users_sso_operations.providerId, providerId),
          ),
        );
      await tx
        .delete(core_users_sso)
        .where(
          and(
            eq(core_users_sso.userId, userId),
            eq(core_users_sso.providerId, providerId),
          ),
        );

      return "disconnected";
    }),

  findConnection: async ({ providerId, userId }) => {
    const [row] = await db
      .select(connectionColumns)
      .from(core_users_sso)
      .where(
        and(
          eq(core_users_sso.userId, userId),
          eq(core_users_sso.providerId, providerId),
        ),
      )
      .limit(1);

    return row ?? null;
  },

  findPreview: async ({ now, providerId, userId }) => {
    const [row] = await db
      .select()
      .from(core_users_sso_operations)
      .where(previewOf(userId, providerId, now))
      .limit(1);

    return row ? toOperation(row) : null;
  },

  link: async values => {
    try {
      return await db.transaction(async tx => {
        const ownerId = await accountOwner(tx, values);
        if (ownerId !== null) return ownershipOutcome(ownerId, values.userId);

        const [own] = await tx
          .select({ providerAccountId: core_users_sso.providerAccountId })
          .from(core_users_sso)
          .where(
            and(
              eq(core_users_sso.userId, values.userId),
              eq(core_users_sso.providerId, values.providerId),
            ),
          )
          .limit(1);

        if (own) return "provider_in_use";

        await tx.insert(core_users_sso).values(values);

        return "linked";
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      const ownerId = await accountOwner(db, values);

      return ownerId === null
        ? "provider_in_use"
        : ownershipOutcome(ownerId, values.userId);
    }
  },

  listConnections: async userId =>
    await db
      .select(connectionColumns)
      .from(core_users_sso)
      .where(eq(core_users_sso.userId, userId))
      .orderBy(asc(core_users_sso.createdAt)),

  listSources: async userId =>
    await db
      .select({
        field: core_users_sso_profile_sources.field,
        providerId: core_users_sso_profile_sources.providerId,
      })
      .from(core_users_sso_profile_sources)
      .where(eq(core_users_sso_profile_sources.userId, userId)),

  readAccount: async userId => {
    const [row] = await db
      .select({
        avatarId: core_users.avatarId,
        email: core_users.email,
        firstName: core_users.firstName,
        id: core_users.id,
        lastName: core_users.lastName,
        name: core_users.name,
        roleId: core_users.roleId,
      })
      .from(core_users)
      .where(eq(core_users.id, userId))
      .limit(1);

    return row ?? null;
  },

  recordAvatar: async ({ fileId, providerId, sha256, sourceUrl, userId }) => {
    await db
      .update(core_users_sso)
      .set({
        avatarFileId: fileId,
        avatarSha256: sha256,
        avatarSourceUrl: sourceUrl,
      })
      .where(
        and(
          eq(core_users_sso.userId, userId),
          eq(core_users_sso.providerId, providerId),
        ),
      );
  },

  recordSignIn: async ({
    providerEmail,
    providerId,
    providerUsername,
    userId,
  }) => {
    await db
      .update(core_users_sso)
      .set({ providerEmail, providerUsername })
      .where(
        and(
          eq(core_users_sso.userId, userId),
          eq(core_users_sso.providerId, providerId),
        ),
      );
  },

  savePreferences: async ({ sources, sync, userId }) => {
    try {
      await db.transaction(async tx => {
        for (const [providerId, syncOnSignIn] of Object.entries(sync)) {
          await tx
            .update(core_users_sso)
            .set({ syncOnSignIn })
            .where(
              and(
                eq(core_users_sso.userId, userId),
                eq(core_users_sso.providerId, providerId),
              ),
            );
        }

        for (const field of SSO_PROFILE_FIELDS) {
          const providerId = sources[field];
          if (providerId === undefined) continue;

          if (providerId === null) {
            await tx
              .delete(core_users_sso_profile_sources)
              .where(
                and(
                  eq(core_users_sso_profile_sources.userId, userId),
                  eq(core_users_sso_profile_sources.field, field),
                ),
              );
            continue;
          }

          await tx
            .insert(core_users_sso_profile_sources)
            .values({ field, providerId, userId })
            .onConflictDoUpdate({
              set: { createdAt: new Date(), providerId },
              target: [
                core_users_sso_profile_sources.userId,
                core_users_sso_profile_sources.field,
              ],
            });
        }
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) return "not_connected";

      throw error;
    }

    return "saved";
  },

  saveOperation: async values => {
    await db.insert(core_users_sso_operations).values(values);
  },

  savePreview: async values => {
    await db.transaction(async tx => {
      await tx
        .delete(core_users_sso_operations)
        .where(
          and(
            eq(core_users_sso_operations.userId, values.userId),
            eq(core_users_sso_operations.providerId, values.providerId),
            eq(core_users_sso_operations.intent, "preview"),
          ),
        );
      await tx.insert(core_users_sso_operations).values(values);
    });
  },

  signInFacts: async userId => {
    const [[user], [passkeys]] = await Promise.all([
      db
        .select({ password: core_users.password })
        .from(core_users)
        .where(eq(core_users.id, userId))
        .limit(1),
      db
        .select({ value: count() })
        .from(core_users_passkeys)
        .where(eq(core_users_passkeys.userId, userId)),
    ]);

    return {
      hasPassword: !!user?.password,
      passkeys: passkeys?.value ?? 0,
    };
  },

  takePreview: async ({ now, providerId, userId }) => {
    const [row] = await db
      .delete(core_users_sso_operations)
      .where(previewOf(userId, providerId, now))
      .returning();

    return row ? toOperation(row) : null;
  },

  writeNames: async ({ userId, values }) => {
    await db.update(core_users).set(values).where(eq(core_users.id, userId));
  },
});
