import { camelCase, index, uniqueIndex } from "drizzle-orm/pg-core";

import { CONTENT_LOCALE_MAX_LENGTH } from "../content/const";
import { core_users } from "./users";

export const core_content_field_locks = camelCase.table.withRLS(
  "core_content_field_locks",
  t => ({
    id: t.serial().primaryKey(),
    contentTypeId: t.varchar({ length: 100 }).notNull(),
    itemId: t.integer().notNull(),
    field: t.varchar({ length: 100 }).notNull(),
    language: t
      .varchar({ length: CONTENT_LOCALE_MAX_LENGTH })
      .notNull()
      .default(""),
    userId: t
      .integer()
      .notNull()
      .references(() => core_users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    acquiredAt: t.timestamp().notNull().defaultNow(),
    expiresAt: t.timestamp().notNull(),
  }),
  t => [
    uniqueIndex("core_content_field_locks_key_unique").on(
      t.contentTypeId,
      t.itemId,
      t.field,
      t.language,
    ),
    index("core_content_field_locks_expires_at_idx").on(t.expiresAt),
    index("core_content_field_locks_user_id_idx").on(t.userId),
  ],
);

export type ContentFieldLockRow = typeof core_content_field_locks.$inferSelect;

export const core_content_drafts = camelCase.table.withRLS(
  "core_content_drafts",
  t => ({
    id: t.serial().primaryKey(),
    contentTypeId: t.varchar({ length: 100 }).notNull(),
    itemId: t.integer().notNull(),
    language: t
      .varchar({ length: CONTENT_LOCALE_MAX_LENGTH })
      .notNull()
      .default(""),
    values: t.jsonb().$type<Record<string, unknown>>().notNull().default({}),
    baseVersion: t.integer().notNull().default(0),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    updatedBy: t.integer().references(() => core_users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
  }),
  t => [
    uniqueIndex("core_content_drafts_key_unique").on(
      t.contentTypeId,
      t.itemId,
      t.language,
    ),
    index("core_content_drafts_updated_at_idx").on(t.updatedAt),
    index("core_content_drafts_updated_by_idx").on(t.updatedBy),
  ],
);

export type ContentDraftRow = typeof core_content_drafts.$inferSelect;
