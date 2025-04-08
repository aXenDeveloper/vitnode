import { relations } from 'drizzle-orm';
import { index, pgTable } from 'drizzle-orm/pg-core';

export const core_languages = pgTable(
  'core_languages',
  t => ({
    id: t.uuid().defaultRandom().primaryKey(),
    code: t.varchar({ length: 32 }).notNull().unique(),
    name: t.varchar({ length: 255 }).notNull(),
    timezone: t.varchar({ length: 255 }).notNull().default('UTC'),
    protected: t.boolean().notNull().default(false),
    default: t.boolean().notNull().default(false),
    enabled: t.boolean().notNull().default(true),
    created_at: t.timestamp().notNull().defaultNow(),
    updated_at: t
      .timestamp()
      .notNull()
      .$onUpdate(() => new Date()),
    time_24: t.boolean().notNull().default(false),
    allow_in_input: t.boolean().default(true).notNull(),
  }),
  t => [
    index('core_languages_code_idx').on(t.code),
    index('core_languages_name_idx').on(t.name),
  ],
);

export const core_languages_words = pgTable(
  'core_languages_words',
  t => ({
    id: t.uuid().defaultRandom().primaryKey(),
    language_code: t
      .varchar()
      .notNull()
      .references(() => core_languages.code, {
        onDelete: 'cascade',
      }),
    plugin_code: t.varchar({ length: 50 }).notNull(),
    item_id: t.varchar().notNull(),
    value: t.text().notNull(),
    table_name: t.varchar({ length: 255 }).notNull(),
    variable: t.varchar({ length: 255 }).notNull(),
  }),
  t => [index('core_languages_words_lang_code_idx').on(t.language_code)],
);

export const core_languages_words_relations = relations(
  core_languages_words,
  ({ one }) => ({
    language: one(core_languages, {
      fields: [core_languages_words.language_code],
      references: [core_languages.code],
    }),
  }),
);
