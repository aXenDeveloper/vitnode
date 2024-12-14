import { relations } from 'drizzle-orm';
import { index, pgTable } from 'drizzle-orm/pg-core';

import { core_users } from './users';

export const core_files = pgTable(
  'core_files',
  t => ({
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
    user_id: t.integer().references(() => core_users.id, {
      onDelete: 'cascade',
    }),
    created_at: t.timestamp().notNull().defaultNow(),
    file_size: t.integer().notNull(),
    mimetype: t.varchar({ length: 255 }).notNull(),
    width: t.integer(),
    height: t.integer(),
  }),
  t => [index('core_files_user_id_idx').on(t.user_id)],
);

export const core_files_relations = relations(core_files, ({ many, one }) => ({
  user: one(core_users, {
    fields: [core_files.user_id],
    references: [core_users.id],
  }),
  using: many(core_files_using),
}));

export const core_files_using = pgTable(
  'core_files_using',
  t => ({
    id: t.serial().primaryKey(),
    file_id: t
      .integer()
      .notNull()
      .references(() => core_files.id),
    plugin: t.varchar({ length: 255 }).notNull(),
    folder: t.varchar({ length: 255 }).notNull(),
  }),
  t => [index('core_files_using_file_id_idx').on(t.file_id)],
);

export const core_files_using_relations = relations(
  core_files_using,
  ({ one }) => ({
    file: one(core_files, {
      fields: [core_files_using.file_id],
      references: [core_files.id],
    }),
  }),
);
