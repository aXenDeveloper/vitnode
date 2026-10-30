import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  camelCase,
  check,
  foreignKey,
  index,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";

import type { SsoOperationIntent, SsoProfileField } from "@/lib/sso-profile";

import { SSO_OPERATION_INTENTS, SSO_PROFILE_FIELDS } from "@/lib/sso-profile";
import {
  USER_FIRST_NAME_MAX_LENGTH,
  USER_HEADLINE_MAX_LENGTH,
  USER_LAST_NAME_MAX_LENGTH,
  USER_PHONE_MAX_LENGTH,
} from "@/lib/user-personal-information";

import { core_files } from "./files";
import { core_languages } from "./languages";
import { core_roles } from "./roles";

export const core_users = camelCase.table.withRLS(
  "core_users",
  t => ({
    id: t.serial().primaryKey(),
    nameCode: t.varchar({ length: 255 }).notNull().unique(),
    name: t.varchar({ length: 255 }).notNull().unique(),
    email: t.varchar({ length: 255 }).notNull().unique(),
    firstName: t.varchar({ length: USER_FIRST_NAME_MAX_LENGTH }),
    lastName: t.varchar({ length: USER_LAST_NAME_MAX_LENGTH }),
    phone: t.varchar({ length: USER_PHONE_MAX_LENGTH }),
    headline: t.varchar({ length: USER_HEADLINE_MAX_LENGTH }),
    showRealName: t.boolean().notNull().default(false),
    password: t.varchar(),
    createdAt: t.timestamp().notNull().defaultNow(),
    newsletter: t.boolean().notNull().default(false),
    avatarColor: t.varchar({ length: 6 }).notNull(),
    emailVerified: t.boolean().notNull().default(false),
    roleId: t
      .integer()
      .references(() => core_roles.id)
      .notNull(),
    birthday: t.timestamp(),
    timeZone: t.varchar({ length: 64 }),
    ipAddress: t.varchar({ length: 40 }).notNull(),
    language: t
      .varchar({ length: 32 })
      .notNull()
      .default("en")
      .references(() => core_languages.code, {
        onDelete: "set default",
      }),
    avatarId: t.integer().references((): AnyPgColumn => core_files.id, {
      onDelete: "set null",
    }),
    coverId: t.integer().references((): AnyPgColumn => core_files.id, {
      onDelete: "set null",
    }),
    lastSeenAt: t.timestamp(),
    hideOnlineStatus: t.boolean().notNull().default(false),
  }),
  t => [
    index("core_users_avatar_id_idx").on(t.avatarId),
    index("core_users_cover_id_idx").on(t.coverId),
    index("core_users_created_at_id_idx").on(t.createdAt, t.id),
    index("core_users_role_id_idx").on(t.roleId),
  ],
);

export const core_users_secondary_roles = camelCase.table.withRLS(
  "core_users_secondary_roles",
  t => ({
    userId: t
      .integer()
      .references(() => core_users.id, {
        onDelete: "cascade",
      })
      .notNull(),
    roleId: t
      .integer()
      .references(() => core_roles.id, {
        onDelete: "cascade",
      })
      .notNull(),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    primaryKey({ columns: [t.userId, t.roleId] }),
    index("core_users_secondary_roles_role_id_idx").on(t.roleId),
  ],
);

export const core_users_sso = camelCase.table.withRLS(
  "core_users_sso",
  t => ({
    userId: t
      .integer()
      .references(() => core_users.id, {
        onDelete: "cascade",
      })
      .notNull(),
    providerId: t.varchar({ length: 255 }).notNull(),
    providerAccountId: t.varchar({ length: 255 }).notNull(),
    providerEmail: t.varchar({ length: 255 }),
    providerUsername: t.varchar({ length: 255 }),
    syncOnSignIn: t.boolean().notNull().default(false),
    avatarSourceUrl: t.varchar({ length: 2048 }),
    avatarSha256: t.varchar({ length: 64 }),
    avatarFileId: t.integer().references((): AnyPgColumn => core_files.id, {
      onDelete: "set null",
    }),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [
    index("core_users_sso_user_id_idx").on(t.userId),
    unique("core_users_sso_provider_account_key").on(
      t.providerId,
      t.providerAccountId,
    ),
    unique("core_users_sso_user_provider_key").on(t.userId, t.providerId),
  ],
);

const inList = (values: readonly string[]) =>
  sql.raw(values.map(value => `'${value}'`).join(", "));

export const core_users_sso_profile_sources = camelCase.table.withRLS(
  "core_users_sso_profile_sources",
  t => ({
    userId: t
      .integer()
      .references(() => core_users.id, { onDelete: "cascade" })
      .notNull(),
    field: t.varchar({ length: 32 }).$type<SsoProfileField>().notNull(),
    providerId: t.varchar({ length: 255 }).notNull(),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    primaryKey({ columns: [t.userId, t.field] }),
    foreignKey({
      name: "core_users_sso_profile_sources_connection_fkey",
      columns: [t.userId, t.providerId],
      foreignColumns: [core_users_sso.userId, core_users_sso.providerId],
    }).onDelete("cascade"),
    check(
      "core_users_sso_profile_sources_field_check",
      sql`${t.field} IN (${inList(SSO_PROFILE_FIELDS)})`,
    ),
  ],
);

export const core_users_sso_operations = camelCase.table.withRLS(
  "core_users_sso_operations",
  t => ({
    id: t.serial().primaryKey(),
    tokenHash: t.varchar({ length: 64 }).unique(),
    userId: t
      .integer()
      .references(() => core_users.id, { onDelete: "cascade" })
      .notNull(),
    providerId: t.varchar({ length: 255 }).notNull(),
    intent: t.varchar({ length: 16 }).$type<SsoOperationIntent>().notNull(),
    fields: t
      .varchar({ length: 32 })
      .$type<SsoProfileField>()
      .array()
      .notNull()
      .default(sql`'{}'::varchar[]`),
    providerAccountId: t.varchar({ length: 255 }),
    preview: t.jsonb().$type<{
      avatarUrl: null | string;
      firstName: null | string;
      lastName: null | string;
    }>(),
    codeVerifier: t.varchar({ length: 128 }),
    nonce: t.varchar({ length: 128 }),
    createdAt: t.timestamp().notNull().defaultNow(),
    expiresAt: t.timestamp().notNull(),
  }),
  t => [
    index("core_users_sso_operations_user_provider_idx").on(
      t.userId,
      t.providerId,
    ),
    index("core_users_sso_operations_expires_at_idx").on(t.expiresAt),
    check(
      "core_users_sso_operations_intent_check",
      sql`${t.intent} IN (${inList(SSO_OPERATION_INTENTS)})`,
    ),
  ],
);

/**
 * A sign-in round trip to a provider: single use, short-lived, bound to the
 * browser that started it (`bindingHash` is the hash of an HttpOnly cookie)
 * and to one provider. Holds the PKCE verifier and OIDC nonce until the
 * callback consumes the row.
 */
export const core_sso_attempts = camelCase.table.withRLS(
  "core_sso_attempts",
  t => ({
    id: t.serial().primaryKey(),
    stateHash: t.varchar({ length: 64 }).notNull().unique(),
    bindingHash: t.varchar({ length: 64 }).notNull(),
    providerId: t.varchar({ length: 255 }).notNull(),
    codeVerifier: t.varchar({ length: 128 }).notNull(),
    nonce: t.varchar({ length: 128 }).notNull(),
    createdAt: t.timestamp().notNull().defaultNow(),
    expiresAt: t.timestamp().notNull(),
  }),
  t => [index("core_sso_attempts_expires_at_idx").on(t.expiresAt)],
);

/**
 * A provider identity that authenticated but brought no trustworthy email.
 * Waits, server-side, for the visitor to open the confirmation link emailed
 * to the address they chose, before an account is created or linked. Single
 * use; the browser holds only the token whose hash is `tokenHash`, in an
 * HttpOnly cookie, and the email holds the one hashed as `confirmHash`.
 */
export const core_sso_pending = camelCase.table.withRLS(
  "core_sso_pending",
  t => ({
    id: t.serial().primaryKey(),
    tokenHash: t.varchar({ length: 64 }).notNull().unique(),
    providerId: t.varchar({ length: 255 }).notNull(),
    providerAccountId: t.varchar({ length: 255 }).notNull(),
    providerUsername: t.varchar({ length: 255 }),
    profile: t.jsonb().$type<{
      avatarUrl: null | string;
      firstName: null | string;
      lastName: null | string;
    }>(),
    email: t.varchar({ length: 255 }),
    confirmHash: t.varchar({ length: 64 }),
    confirmExpiresAt: t.timestamp(),
    confirmSends: t.integer().notNull().default(0),
    confirmSentAt: t.timestamp(),
    createdAt: t.timestamp().notNull().defaultNow(),
    expiresAt: t.timestamp().notNull(),
  }),
  t => [index("core_sso_pending_expires_at_idx").on(t.expiresAt)],
);

export const core_users_confirm_emails = camelCase.table.withRLS(
  "core_users_confirm_emails",
  t => ({
    id: t.serial().primaryKey(),
    userId: t
      .integer()
      .references(() => core_users.id, {
        onDelete: "cascade",
      })
      .notNull(),
    token: t.varchar({ length: 100 }).notNull().unique(),
    createdAt: t.timestamp().notNull().defaultNow(),
    expiresAt: t.timestamp().notNull(),
    ipAddress: t.varchar({ length: 40 }).notNull(),
  }),
);

export const core_users_forgot_password = camelCase.table.withRLS(
  "core_users_forgot_password",
  t => ({
    id: t.serial().primaryKey(),
    userId: t
      .integer()
      .references(() => core_users.id, {
        onDelete: "cascade",
      })
      .notNull()
      .unique(),
    token: t.varchar({ length: 100 }).notNull().unique(),
    ipAddress: t.varchar({ length: 40 }).notNull(),
    createdAt: t.timestamp().notNull().defaultNow(),
    expiresAt: t.timestamp().notNull(),
  }),
);
