import { relations } from 'drizzle-orm';
import { index, pgTable } from 'drizzle-orm/pg-core';

export const core_languages = pgTable(
  'core_languages',
  t => ({
    id: t.serial().primaryKey(),
    code: t.varchar({ length: 32 }).notNull().unique(),
    name: t.varchar({ length: 255 }).notNull(),
    timezone: t.varchar({ length: 255 }).notNull().default('UTC'),
    protected: t.boolean().notNull().default(false),
    default: t.boolean().notNull().default(false),
    enabled: t.boolean().notNull().default(true),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .$onUpdate(() => new Date()),
    time24: t.boolean().notNull().default(false),
  }),
  t => [
    index('core_languages_code_idx').on(t.code),
    index('core_languages_name_idx').on(t.name),
  ],
).enableRLS();

export const core_languages_words = pgTable(
  'core_languages_words',
  t => ({
    id: t.serial().primaryKey(),
    languageCode: t
      .varchar()
      .notNull()
      .references(() => core_languages.code, {
        onDelete: 'cascade',
      }),
    pluginCode: t.varchar({ length: 50 }).notNull(),
    itemId: t.integer().notNull(),
    value: t.text().notNull(),
    tableName: t.varchar({ length: 255 }).notNull(),
    variable: t.varchar({ length: 255 }).notNull(),
  }),
  t => [index('core_languages_words_lang_code_idx').on(t.languageCode)],
).enableRLS();

export const core_languages_words_relations = relations(
  core_languages_words,
  ({ one }) => ({
    language: one(core_languages, {
      fields: [core_languages_words.languageCode],
      references: [core_languages.code],
    }),
  }),
);
