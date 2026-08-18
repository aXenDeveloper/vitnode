import type { SQL } from "drizzle-orm";

import { sql } from "drizzle-orm";
import { camelCase, customType, index, unique } from "drizzle-orm/pg-core";

import { core_users } from "./users";

// Drizzle ships no native `tsvector` type, so we declare it once and reuse it
// for the generated full-text-search column below. The column and its GIN index
// live in the schema (not a hand-written migration) so `drizzle-kit generate`
// and `push` stay the source of truth.
// https://orm.drizzle.team/docs/guides/postgresql-full-text-search
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

// Maps a VitNode language code to the Postgres text-search configuration used
// for stemming and stop-words. Besides the stable Snowball configs shipped by
// every Postgres, `pl` maps to `polish`, a hunspell dictionary VitNode's dev
// image installs (docker/postgres) - if you run your own Postgres without it,
// remove `pl` here or install the dictionary, otherwise the generated column
// fails to build. Codes that aren't mapped fall back to `simple` - tokenize +
// lowercase, no stemming.
export const SEARCH_TEXT_CONFIGS: Record<string, string> = {
  da: "danish",
  de: "german",
  en: "english",
  es: "spanish",
  fi: "finnish",
  fr: "french",
  hu: "hungarian",
  it: "italian",
  nl: "dutch",
  no: "norwegian",
  pl: "polish",
  pt: "portuguese",
  ro: "romanian",
  ru: "russian",
  sv: "swedish",
  tr: "turkish",
};

export const DEFAULT_SEARCH_TEXT_CONFIG = "simple";

// Resolves a language code (e.g. "en" or "en-US") to its Postgres config, used
// by the search adapter so `websearch_to_tsquery` matches the stored vector.
export const resolveSearchTextConfig = (languageCode?: null | string): string =>
  (languageCode &&
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    SEARCH_TEXT_CONFIGS[languageCode.split("-")[0]?.toLowerCase() ?? ""]) ||
  DEFAULT_SEARCH_TEXT_CONFIG;

// SQL `CASE` that picks the text-search config per row from `languageCode`. The
// branches are constant `regconfig` literals, keeping the generated-column
// expression IMMUTABLE (a dynamic `column::regconfig` cast is rejected).
const SEARCH_CONFIG_CASE = `CASE lower(split_part("core_search_index"."languageCode", '-', 1)) ${Object.entries(
  SEARCH_TEXT_CONFIGS,
)
  .map(([code, config]) => `WHEN '${code}' THEN '${config}'::regconfig`)
  .join(" ")} ELSE '${DEFAULT_SEARCH_TEXT_CONFIG}'::regconfig END`;

// One row per (itemType, itemId, languageCode): multi-language content is
// indexed once per language so search and discovery can be scoped to the
// viewer's locale.
export const core_search_index = camelCase.table.withRLS(
  "core_search_index",
  t => ({
    id: t.serial().primaryKey(),
    pluginId: t.varchar({ length: 255 }).notNull(),
    itemType: t.varchar({ length: 100 }).notNull(),
    itemId: t.integer().notNull(),
    languageCode: t.varchar({ length: 32 }).notNull().default(""),
    authorId: t.integer().references(() => core_users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    title: t.text().notNull().default(""),
    content: t.text().notNull().default(""),
    // Generated tsvector for full-text search. The text-search config is chosen
    // per row from `languageCode` (see `SEARCH_CONFIG_CASE`); title is weighted
    // above body. Referenced via raw `sql` in the Postgres search adapter.
    searchVector: tsvector("search_vector")
      .notNull()
      .generatedAlwaysAs(
        (): SQL =>
          sql`setweight(to_tsvector(${sql.raw(SEARCH_CONFIG_CASE)}, coalesce(${core_search_index.title}, '')), 'A') || setweight(to_tsvector(${sql.raw(SEARCH_CONFIG_CASE)}, coalesce(${core_search_index.content}, '')), 'B')`,
      ),
    containerType: t.varchar({ length: 100 }),
    containerId: t.integer(),
    url: t.text(),
    isPublic: t.boolean().notNull().default(true),
    metadata: t.jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t.timestamp(),
    indexedAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    unique("core_search_index_item_unique").on(
      t.itemType,
      t.itemId,
      t.languageCode,
    ),
    index("core_search_index_search_vector_idx").using("gin", t.searchVector),
    index("core_search_index_created_at_idx").on(t.createdAt),
    index("core_search_index_author_id_idx").on(t.authorId),
    index("core_search_index_item_type_idx").on(t.itemType),
    index("core_search_index_language_code_idx").on(t.languageCode),
    index("core_search_index_is_public_idx").on(t.isPublic),
  ],
);
