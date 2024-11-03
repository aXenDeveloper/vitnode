import { relations } from 'drizzle-orm';
import { index, pgTable } from 'drizzle-orm/pg-core';

import { core_groups } from './groups';
import { core_languages } from './languages';

export const core_users = pgTable(
  'core_users',
  t => ({
    id: t.serial().primaryKey(),
    name_seo: t.varchar({ length: 255 }).notNull().unique(),
    name: t.varchar({ length: 255 }).notNull().unique(),
    email: t.varchar({ length: 255 }).notNull().unique(),
    password: t.varchar().notNull(),
    joined_at: t.timestamp().notNull().defaultNow(),
    newsletter: t.boolean().notNull().default(false),
    avatar_color: t.varchar({ length: 6 }).notNull(),
    email_verified: t.boolean().notNull().default(false),
    group_id: t
      .integer()
      .references(() => core_groups.id)
      .notNull(),
    first_name: t.varchar({ length: 255 }),
    last_name: t.varchar({ length: 255 }),
    birthday: t.timestamp(),
    ip_address: t.varchar({ length: 255 }).notNull(),
    language: t
      .varchar({ length: 5 })
      .notNull()
      .default('en')
      .references(() => core_languages.code, {
        onDelete: 'set default',
      }),
  }),
  t => [
    index('core_users_name_seo_idx').on(t.name_seo),
    index('core_users_name_idx').on(t.name),
    index('core_users_email_idx').on(t.email),
  ],
);

export const core_users_relations = relations(core_users, ({ one }) => ({
  group: one(core_groups, {
    fields: [core_users.group_id],
    references: [core_groups.id],
  }),
  avatar: one(core_files_avatars, {
    fields: [core_users.id],
    references: [core_files_avatars.user_id],
  }),
  language: one(core_languages, {
    fields: [core_users.language],
    references: [core_languages.code],
  }),
  confirm_email: one(core_users_confirm_emails, {
    fields: [core_users.id],
    references: [core_users_confirm_emails.user_id],
  }),
}));

export const core_files_avatars = pgTable('core_files_avatars', t => ({
  id: t.serial().primaryKey(),
  dir_folder: t.varchar({ length: 255 }).notNull(),
  file_name: t.varchar({ length: 255 }).notNull(),
  created_at: t.timestamp().notNull().defaultNow(),
  file_size: t.integer().notNull(),
  mimetype: t.varchar({ length: 255 }).notNull(),
  extension: t.varchar({ length: 32 }).notNull(),
  user_id: t.integer().references(() => core_users.id, {
    onDelete: 'cascade',
  }),
}));

export const core_files_avatars_relations = relations(
  core_files_avatars,
  ({ one }) => ({
    user: one(core_users, {
      fields: [core_files_avatars.user_id],
      references: [core_users.id],
    }),
  }),
);

export const core_users_pass_reset = pgTable('core_users_pass_reset', t => ({
  id: t.serial().primaryKey(),
  user_id: t
    .integer()
    .references(() => core_users.id, {
      onDelete: 'cascade',
    })
    .notNull(),
  key: t.varchar({ length: 100 }).notNull().unique(),
  created_at: t.timestamp().notNull().defaultNow(),
  expires: t.timestamp().notNull(),
}));

export const core_users_pass_reset_relations = relations(
  core_users_pass_reset,
  ({ one }) => ({
    user: one(core_users, {
      fields: [core_users_pass_reset.user_id],
      references: [core_users.id],
    }),
  }),
);

export const core_users_confirm_emails = pgTable(
  'core_users_confirm_emails',
  t => ({
    id: t.serial().primaryKey(),
    user_id: t
      .integer()
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
