import { camelCase, index } from "drizzle-orm/pg-core";

export const core_languages = camelCase.table.withRLS(
  "core_languages",
  t => ({
    id: t.serial().primaryKey(),
    code: t.varchar({ length: 32 }).notNull().unique(),
    name: t.varchar({ length: 255 }).notNull(),
    timezone: t.varchar({ length: 255 }).notNull().default("UTC"),
    protected: t.boolean().notNull().default(false),
    default: t.boolean().notNull().default(false),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    time24: t.boolean().notNull().default(false),
  }),
  t => [
    index("core_languages_code_idx").on(t.code),
    index("core_languages_name_idx").on(t.name),
  ],
);

export const core_languages_words = camelCase.table.withRLS(
  "core_languages_words",
  t => ({
    id: t.serial().primaryKey(),
    languageCode: t
      .varchar()
      .notNull()
      .references(() => core_languages.code, {
        onDelete: "cascade",
      }),
    pluginCode: t.varchar({ length: 50 }).notNull(),
    itemId: t.integer().notNull(),
    value: t.text().notNull(),
    tableName: t.varchar({ length: 255 }).notNull(),
    variable: t.varchar({ length: 255 }).notNull(),
  }),
  t => [index("core_languages_words_lang_code_idx").on(t.languageCode)],
);
