import { camelCase, index, primaryKey } from "drizzle-orm/pg-core";

import { core_languages } from "./languages";
import { core_roles } from "./roles";

export const core_users = camelCase.table.withRLS(
  "core_users",
  t => ({
    id: t.serial().primaryKey(),
    nameCode: t.varchar({ length: 255 }).notNull().unique(),
    name: t.varchar({ length: 255 }).notNull().unique(),
    email: t.varchar({ length: 255 }).notNull().unique(),
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
    ipAddress: t.varchar({ length: 40 }).notNull(),
    language: t
      .varchar({ length: 32 })
      .notNull()
      .default("en")
      .references(() => core_languages.code, {
        onDelete: "set default",
      }),
  }),
  t => [
    index("core_users_name_code_idx").on(t.nameCode),
    index("core_users_name_idx").on(t.name),
    index("core_users_email_idx").on(t.email),
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
    index("core_users_secondary_roles_user_id_idx").on(t.userId),
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
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [index("core_users_sso_user_id_idx").on(t.userId)],
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
