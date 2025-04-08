import { relations } from 'drizzle-orm';
import { index, pgTable } from 'drizzle-orm/pg-core';

import { core_groups } from './groups';
import { core_languages } from './languages';

export const core_users = pgTable(
  'core_users',
  t => ({
    id: t.uuid().defaultRandom().primaryKey(),
    name_code: t.varchar({ length: 255 }).notNull().unique(),
    name: t.varchar({ length: 255 }).notNull().unique(),
    email: t.varchar({ length: 255 }).notNull().unique(),
    password: t.varchar(),
    joined_at: t.timestamp().notNull().defaultNow(),
    newsletter: t.boolean().notNull().default(false),
    avatar_color: t.varchar({ length: 6 }).notNull(),
    email_verified: t.boolean().notNull().default(false),
    group_id: t
      .uuid()
      .references(() => core_groups.id)
      .notNull(),
    birthday: t.timestamp(),
    ip_address: t.varchar({ length: 40 }).notNull(),
    language: t
      .varchar({ length: 5 })
      .notNull()
      .default('en')
      .references(() => core_languages.code, {
        onDelete: 'set default',
      }),
  }),
  t => [
    index('core_users_name_code_idx').on(t.name_code),
    index('core_users_name_idx').on(t.name),
    index('core_users_email_idx').on(t.email),
  ],
);

export const core_users_relations = relations(core_users, ({ one, many }) => ({
  group: one(core_groups, {
    fields: [core_users.group_id],
    references: [core_groups.id],
  }),
  language: one(core_languages, {
    fields: [core_users.language],
    references: [core_languages.code],
  }),
  confirm_email: one(core_users_confirm_emails, {
    fields: [core_users.id],
    references: [core_users_confirm_emails.user_id],
  }),
  sso: many(core_users_sso),
  forgot_password: one(core_users_forgot_password, {
    fields: [core_users.id],
    references: [core_users_forgot_password.user_id],
  }),
}));

export const core_users_sso = pgTable(
  'core_users_sso',
  t => ({
    user_id: t
      .uuid()
      .references(() => core_users.id, {
        onDelete: 'cascade',
      })
      .notNull(),
    provider_id: t.varchar({ length: 255 }).notNull(),
    provider_account_id: t.varchar({ length: 255 }).notNull(),
    created_at: t.timestamp().notNull().defaultNow(),
    updated_at: t
      .timestamp()
      .notNull()
      .$onUpdate(() => new Date()),
  }),
  t => [index('core_users_sso_user_id_idx').on(t.user_id)],
);

export const core_users_sso_relations = relations(
  core_users_sso,
  ({ one }) => ({
    user: one(core_users, {
      fields: [core_users_sso.user_id],
      references: [core_users.id],
    }),
  }),
);

export const core_users_confirm_emails = pgTable(
  'core_users_confirm_emails',
  t => ({
    id: t.uuid().defaultRandom().primaryKey(),
    user_id: t
      .uuid()
      .references(() => core_users.id, {
        onDelete: 'cascade',
      })
      .notNull(),
    token: t.varchar({ length: 100 }).notNull().unique(),
    created_at: t.timestamp().notNull().defaultNow(),
    expires: t.timestamp().notNull(),
  }),
);

export const core_users_confirm_emails_relations = relations(
  core_users_confirm_emails,
  ({ one }) => ({
    user: one(core_users, {
      fields: [core_users_confirm_emails.user_id],
      references: [core_users.id],
    }),
  }),
);

export const core_users_forgot_password = pgTable(
  'core_users_forgot_password',
  t => ({
    id: t.uuid().defaultRandom().primaryKey(),
    user_id: t
      .uuid()
      .references(() => core_users.id, {
        onDelete: 'cascade',
      })
      .notNull()
      .unique(),
    token: t.varchar({ length: 100 }).notNull().unique(),
    ip_address: t.varchar({ length: 40 }).notNull(),
    created_at: t.timestamp().notNull().defaultNow(),
    expires_at: t.timestamp().notNull(),
  }),
);

export const core_users_forgot_password_relations = relations(
  core_users_forgot_password,
  ({ one }) => ({
    user: one(core_users, {
      fields: [core_users_forgot_password.user_id],
      references: [core_users.id],
    }),
  }),
);
