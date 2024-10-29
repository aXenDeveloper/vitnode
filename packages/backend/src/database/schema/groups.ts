import { relations } from 'drizzle-orm';
import { pgTable } from 'drizzle-orm/pg-core';

import { core_languages_words } from './languages';

export const core_groups = pgTable('core_groups', t => ({
  id: t.serial().primaryKey(),
  created_at: t.timestamp().notNull().defaultNow(),
  updated_at: t.timestamp().notNull().defaultNow(),
  protected: t.boolean().notNull().default(false),
  default: t.boolean().notNull().default(false),
  root: t.boolean().notNull().default(false),
  guest: t.boolean().notNull().default(false),
  color: t.varchar({ length: 19 }),
  files_allow_upload: t.boolean().notNull().default(true),
  files_total_max_storage: t.integer().notNull().default(500000),
  files_max_storage_for_submit: t.integer().notNull().default(10000),
}));

export const core_groups_relation = relations(core_groups, ({ many }) => ({
  name: many(core_languages_words),
}));

export const core_languages_words_relation = relations(
  core_languages_words,
  ({ one }) => ({
    group: one(core_groups, {
      fields: [core_languages_words.item_id],
      references: [core_groups.id],
    }),
  }),
);
