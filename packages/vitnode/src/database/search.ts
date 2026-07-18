import { index, pgTable, unique } from "drizzle-orm/pg-core";

import { core_users } from "./users";

// The `search_vector` tsvector column and its GIN index are added by a custom
// SQL migration, not here - Drizzle's diff for generated FTS expressions is
// unreliable. Queries reference it via raw `sql` in the Postgres search adapter.
export const core_search_index = pgTable(
  "core_search_index",
  t => ({
    id: t.serial().primaryKey(),
    pluginId: t.varchar({ length: 255 }).notNull(),
    itemType: t.varchar({ length: 100 }).notNull(),
    itemId: t.integer().notNull(),
    authorId: t.integer().references(() => core_users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    title: t.text().notNull().default(""),
    content: t.text().notNull().default(""),
    containerType: t.varchar({ length: 100 }),
    containerId: t.integer(),
    url: t.text(),
    isPublic: t.boolean().notNull().default(true),
    metadata: t
      .jsonb()
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t.timestamp(),
    indexedAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    unique("core_search_index_item_unique").on(t.itemType, t.itemId),
    index("core_search_index_created_at_idx").on(t.createdAt),
    index("core_search_index_author_id_idx").on(t.authorId),
    index("core_search_index_item_type_idx").on(t.itemType),
    index("core_search_index_is_public_idx").on(t.isPublic),
  ],
).enableRLS();
