import { sql } from "drizzle-orm";
import { camelCase, index, uniqueIndex } from "drizzle-orm/pg-core";

import type {
  ContentAnyRevisionSnapshot,
  ContentRevisionSnapshot,
  ContentSnapshotValue,
  ContentTranslationRevisionSnapshot,
} from "../content/revisions";

import {
  CONTENT_ACTOR_TYPES,
  CONTENT_DELIVERY_PATH_MAX_LENGTH,
  CONTENT_REVISION_OPERATIONS,
  CONTENT_SCHEDULE_ACTIONS,
  CONTENT_SCHEDULE_STATUSES,
  CONTENT_SLUG_DEFAULT_LENGTH,
} from "../content/const";
import { core_files } from "./files";
import { core_users } from "./users";

export const core_content_revisions = camelCase.table.withRLS(
  "core_content_revisions",
  t => ({
    id: t.serial().primaryKey(),
    pluginId: t.varchar({ length: 255 }).notNull(),
    contentTypeId: t.varchar({ length: 100 }).notNull(),
    itemId: t.integer().notNull(),

    languageId: t.integer(),
    /** The version the record holds *after* this mutation. */
    version: t.integer().notNull(),
    operation: t
      .varchar({ enum: CONTENT_REVISION_OPERATIONS, length: 20 })
      .notNull(),
    snapshot: t
      .jsonb()
      .$type<ContentAnyRevisionSnapshot>()
      .notNull()
      .default({} as ContentRevisionSnapshot),
    /** Field names this mutation moved, so the history list needs no snapshot. */
    changedFields: t
      .jsonb()
      .$type<string[]>()
      .notNull()
      .default([] as string[]),
    actorType: t
      .varchar({ enum: CONTENT_ACTOR_TYPES, length: 16 })
      .notNull()
      .default("system"),
    actorUserId: t.integer().references(() => core_users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),

    restoredFromRevisionId: t.integer(),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    // One revision per version, enforced by the database rather than by code:
    // this is what makes "exactly one revision per real mutation" true even
    // under two concurrent writers, and it doubles as the history index, since
    // `ORDER BY version DESC` for one record reads it directly.
    //
    // No `pluginId` in the key, deliberately. `validateContentTypes` rejects a
    // duplicate content type id across *every* installed plugin at boot, so an
    // id already identifies exactly one content type and one table - adding the
    // owner would widen the index without excluding anything. It is still a
    // column, because ownership is what the cleanup job keys off.
    //
    // Partial from Stage 5B on. A translation's version counter is its own, so
    // English v3 and Polish v3 are two different facts and a single key over
    // `(contentTypeId, itemId, version)` would reject the second one. Two partial
    // indexes rather than one over a nullable `languageId`, because Postgres
    // treats every `NULL` as distinct - a shared key including it would enforce
    // nothing at all for the non-localized case it exists to protect.
    uniqueIndex("core_content_revisions_item_version_unique")
      .on(t.contentTypeId, t.itemId, t.version)
      .where(sql`"languageId" IS NULL`),
    uniqueIndex("core_content_revisions_translation_version_unique")
      .on(t.contentTypeId, t.itemId, t.languageId, t.version)
      .where(sql`"languageId" IS NOT NULL`),
    // The locale history read: one record's revisions in one language, newest
    // first. The partial unique index above cannot serve it - a partial index is
    // only usable for queries the planner can prove match its predicate, and the
    // history list does not filter on `"languageId" IS NOT NULL` in those terms.
    index("core_content_revisions_language_idx").on(
      t.contentTypeId,
      t.itemId,
      t.languageId,
      t.version,
    ),
    index("core_content_revisions_plugin_id_idx").on(t.pluginId),
    // Postgres does not index the child side of a foreign key on its own, and
    // `ON DELETE SET NULL` scans it on every user deletion.
    index("core_content_revisions_actor_user_id_idx").on(t.actorUserId),
  ],
);

export type ContentRevisionRow = typeof core_content_revisions.$inferSelect;

export const core_content_file_refs = camelCase.table.withRLS(
  "core_content_file_refs",
  t => ({
    id: t.serial().primaryKey(),
    revisionId: t
      .integer()
      .notNull()
      .references(() => core_content_revisions.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    fileId: t
      .integer()
      .notNull()
      .references(() => core_files.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    // One pin per pair, so re-capturing the same state twice cannot double-count
    // - and so "is this file still needed?" is an index lookup rather than a scan.
    uniqueIndex("core_content_file_refs_unique").on(t.revisionId, t.fileId),
    // Postgres does not index the child side of a foreign key on its own, and
    // `ON DELETE RESTRICT` scans this one on every attempt to delete a file.
    index("core_content_file_refs_file_id_idx").on(t.fileId),
  ],
);

export type ContentFileRefRow = typeof core_content_file_refs.$inferSelect;

export const core_content_schedules = camelCase.table.withRLS(
  "core_content_schedules",
  t => ({
    id: t.serial().primaryKey(),
    pluginId: t.varchar({ length: 255 }).notNull(),
    contentTypeId: t.varchar({ length: 100 }).notNull(),
    itemId: t.integer().notNull(),
    action: t.varchar({ enum: CONTENT_SCHEDULE_ACTIONS, length: 16 }).notNull(),
    scheduledFor: t.timestamp().notNull(),

    generation: t.integer().notNull().default(1),
    status: t
      .varchar({ enum: CONTENT_SCHEDULE_STATUSES, length: 16 })
      .notNull()
      .default("pending"),
    /** The human who asked for it. A schedule is never created by the system. */
    createdBy: t.integer().references(() => core_users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    completedAt: t.timestamp(),
    /** Why the last attempt failed. Set on an overdue row, cleared on success. */
    lastError: t.text(),

    effectsError: t.text(),
  }),
  t => [
    // At most one *pending* schedule per record and action, enforced by the
    // database. Rescheduling cancels the old row and inserts a new one in one
    // transaction, so this is what makes "cancel, then insert" safe against a
    // second request arriving between the two statements.
    uniqueIndex("core_content_schedules_active_unique")
      .on(t.contentTypeId, t.itemId, t.action)
      .where(sql`status = 'pending'`),
    // The queue worker's read: everything due, oldest first.
    index("core_content_schedules_due_idx").on(t.status, t.scheduledFor),
    index("core_content_schedules_item_idx").on(t.contentTypeId, t.itemId),
    index("core_content_schedules_plugin_id_idx").on(t.pluginId),
    index("core_content_schedules_created_by_idx").on(t.createdBy),
  ],
);

export type ContentScheduleRow = typeof core_content_schedules.$inferSelect;

export const core_content_slug_history = camelCase.table.withRLS(
  "core_content_slug_history",
  t => ({
    id: t.serial().primaryKey(),
    pluginId: t.varchar({ length: 255 }).notNull(),
    contentTypeId: t.varchar({ length: 100 }).notNull(),
    itemId: t.integer().notNull(),
    /** `NULL` for a shared slug. See the table comment. */
    languageId: t.integer(),
    slug: t.varchar({ length: CONTENT_SLUG_DEFAULT_LENGTH }).notNull(),

    path: t.varchar({ length: CONTENT_DELIVERY_PATH_MAX_LENGTH }).notNull(),
    createdAt: t.timestamp().notNull().defaultNow(),
    /** When this slug stopped being the record's address. `NULL` while current. */
    retiredAt: t.timestamp(),
  }),
  t => [
    // The reservation, and the resolver's lookup, in one index each.
    //
    // Two partial uniques rather than one over a nullable `languageId`, for
    // exactly the reason `core_content_revisions` needs two: Postgres treats every
    // `NULL` as distinct, so a single key including it would enforce nothing at
    // all for the shared case it exists to protect.
    //
    // No `pluginId` in either key. `validateContentTypes` rejects a duplicate
    // content type id across every installed plugin at boot, so an id already
    // identifies one content type - adding the owner would widen the index without
    // excluding anything. It is still a column, because ownership is what a
    // cleanup or an audit keys off.
    uniqueIndex("core_content_slug_history_shared_unique")
      .on(t.contentTypeId, t.slug)
      .where(sql`"languageId" IS NULL`),
    uniqueIndex("core_content_slug_history_locale_unique")
      .on(t.contentTypeId, t.languageId, t.slug)
      .where(sql`"languageId" IS NOT NULL`),
    // One record's history, for the AdminCP panel and for retiring the slug a
    // mutation just moved away from. The unique indexes above cannot serve it:
    // they lead with the slug rather than with the item, and a partial index is
    // only usable for queries the planner can prove match its predicate.
    index("core_content_slug_history_item_idx").on(
      t.contentTypeId,
      t.itemId,
      t.languageId,
    ),
    index("core_content_slug_history_plugin_id_idx").on(t.pluginId),
  ],
);

export type ContentSlugHistoryRow =
  typeof core_content_slug_history.$inferSelect;

/** Re-exported so `src/database` consumers need not reach into `content/`. */
export type {
  ContentAnyRevisionSnapshot,
  ContentRevisionSnapshot,
  ContentSnapshotValue,
  ContentTranslationRevisionSnapshot,
};
