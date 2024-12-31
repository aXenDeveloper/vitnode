import { relations, sql } from 'drizzle-orm';
import { pgEnum, pgTable } from 'drizzle-orm/pg-core';

export const appCoreTypeEnum = pgEnum('vitnode_core_app_type', [
  'website',
  'article',
  'book',
  'music.album',
  'music.playlist',
  'music.radio_station',
  'music.song',
  'profile',
  'video.episode',
  'video.movie',
  'video.tv_show',
]);

export const core_config_files = pgTable('core_config_files', t => ({
  id: t.serial().primaryKey(),
  extension: t.varchar({ length: 32 }).notNull(),
  file_alt: t.varchar({ length: 255 }),
  file_name: t.varchar({ length: 255 }).notNull(),
  file_name_original: t
    .varchar({
      length: 255,
    })
    .notNull(),
  dir_folder: t.varchar({ length: 255 }).notNull(),
  created_at: t.timestamp().notNull().defaultNow(),
  file_size: t.integer().notNull(),
  mimetype: t.varchar({ length: 255 }).notNull(),
  width: t.integer(),
  height: t.integer(),
}));

export const core_config = pgTable('core_config', t => ({
  app_type: appCoreTypeEnum().notNull().default('website'),
  restart_server: t.boolean().notNull().default(false),
  editor_sticky: t.boolean().notNull().default(true),
  site_name: t.varchar({ length: 150 }).notNull().default('VitNode'),
  site_short_name: t.varchar({ length: 75 }).notNull().default('VitNode'),
  contact_email: t.varchar().notNull().default(''),
  last_updated: t.timestamp().notNull().defaultNow(),
  auth_force_login: t.boolean().notNull().default(false),
  auth_lock_register: t.boolean().notNull().default(false),
  auth_require_confirm_email: t.boolean().notNull().default(false),
  email_color_primary: t
    .varchar({
      length: 50,
    })
    .notNull()
    .default('hsl(220, 74%, 50%)'),
  email_color_primary_foreground: t
    .varchar({
      length: 50,
    })
    .notNull()
    .default('hsl(210, 40%, 98%)'),
  email_logo_file_id: t
    .integer()
    .references(() => core_config_files.id, {
      onDelete: 'set null',
    })
    .default(sql`NULL`),
  logo_dark: t
    .integer()
    .references(() => core_config_files.id, {
      onDelete: 'set null',
    })
    .default(sql`NULL`),
  logo_light: t
    .integer()
    .references(() => core_config_files.id, {
      onDelete: 'set null',
    })
    .default(sql`NULL`),
  mobile_logo_dark: t
    .integer()
    .references(() => core_config_files.id, {
      onDelete: 'set null',
    })
    .default(sql`NULL`),
  mobile_logo_light: t
    .integer()
    .references(() => core_config_files.id, {
      onDelete: 'set null',
    })
    .default(sql`NULL`),
  logo_width: t.integer().notNull().default(10),
  logo_mobile_width: t.integer().notNull().default(3),
  logo_text: t.varchar().notNull().default('VitNode'),
  admin_note: t.text().notNull().default('Enter your note here. :)'),
  admin_note_updated_at: t.timestamp().notNull().defaultNow(),
}));

export const core_config__types = core_config.$inferSelect;
export const core_config__insert_types = core_config.$inferInsert;

export const core_config_relations = relations(core_config, ({ one }) => ({
  email_logo: one(core_config_files, {
    fields: [core_config.email_logo_file_id],
    references: [core_config_files.id],
  }),
  logo_dark: one(core_config_files, {
    fields: [core_config.logo_dark],
    references: [core_config_files.id],
  }),
  logo_light: one(core_config_files, {
    fields: [core_config.logo_light],
    references: [core_config_files.id],
  }),
  mobile_logo_dark: one(core_config_files, {
    fields: [core_config.mobile_logo_dark],
    references: [core_config_files.id],
  }),
  mobile_logo_light: one(core_config_files, {
    fields: [core_config.mobile_logo_light],
    references: [core_config_files.id],
  }),
}));
