import { relations } from "drizzle-orm";
import { index, pgTable, primaryKey } from "drizzle-orm/pg-core";

import { core_languages } from "./languages";
import { core_roles } from "./roles";

export const core_users = pgTable(
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
).enableRLS();

export const core_users_relations = relations(core_users, ({ one, many }) => ({
  group: one(core_roles, {
    fields: [core_users.roleId],
    references: [core_roles.id],
  }),
  secondary_roles: many(core_users_secondary_roles),
  language: one(core_languages, {
    fields: [core_users.language],
    references: [core_languages.code],
  }),
  confirm_email: one(core_users_confirm_emails, {
    fields: [core_users.id],
    references: [core_users_confirm_emails.userId],
  }),
  sso: many(core_users_sso),
  forgot_password: one(core_users_forgot_password, {
    fields: [core_users.id],
    references: [core_users_forgot_password.userId],
  }),
}));

export const core_users_secondary_roles = pgTable(
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
).enableRLS();

export const core_users_secondary_roles_relations = relations(
  core_users_secondary_roles,
  ({ one }) => ({
    user: one(core_users, {
      fields: [core_users_secondary_roles.userId],
      references: [core_users.id],
    }),
    role: one(core_roles, {
      fields: [core_users_secondary_roles.roleId],
      references: [core_roles.id],
    }),
  }),
);

export const core_users_sso = pgTable(
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
).enableRLS();

export const core_users_sso_relations = relations(
  core_users_sso,
  ({ one }) => ({
    user: one(core_users, {
      fields: [core_users_sso.userId],
      references: [core_users.id],
    }),
  }),
);

export const core_users_confirm_emails = pgTable(
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
).enableRLS();

export const core_users_confirm_emails_relations = relations(
  core_users_confirm_emails,
  ({ one }) => ({
    user: one(core_users, {
      fields: [core_users_confirm_emails.userId],
      references: [core_users.id],
    }),
  }),
);

export const core_users_forgot_password = pgTable(
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
).enableRLS();

export const core_users_forgot_password_relations = relations(
  core_users_forgot_password,
  ({ one }) => ({
    user: one(core_users, {
      fields: [core_users_forgot_password.userId],
      references: [core_users.id],
    }),
  }),
);
