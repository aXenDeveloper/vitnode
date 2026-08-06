import { sql } from "drizzle-orm";
import { index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";

import type {
  ContentAnyRevisionSnapshot,
  ContentRevisionSnapshot,
  ContentSnapshotValue,
  ContentTranslationRevisionSnapshot,
} from "../content/revisions";

import {
  CONTENT_ACTOR_TYPES,
  CONTENT_REVISION_OPERATIONS,
  CONTENT_SCHEDULE_ACTIONS,
  CONTENT_SCHEDULE_STATUSES,
} from "../content/const";
import { core_users } from "./users";

/**
 * Revision history for every content type with `editorial: { enabled: true }`.
 *
 * One shared table rather than one per content type: a content table is
 * generated at runtime from a descriptor, so core's static schema cannot name
 * it - and a per-type revision table would mean a second generated table and a
 * second migration for every plugin, with no cross-type query left possible.
 *
 * There is deliberately **no foreign key to the record**, for the same reason
 * `core_search_index` has none: the target table is not knowable here. The
 * consequences are handled rather than ignored - every read is scoped by
 * `(pluginId, contentTypeId, itemId)`, a delete leaves a final `delete`
 * revision behind, and rows whose content type is no longer registered are
 * swept up by the editorial cleanup job.
 */
export const core_content_revisions = pgTable(
  "core_content_revisions",
  t => ({
    id: t.serial().primaryKey(),
    pluginId: t.varchar({ length: 255 }).notNull(),
    contentTypeId: t.varchar({ length: 100 }).notNull(),
    itemId: t.integer().notNull(),
    /**
     * Which language this revision belongs to, or `NULL` for a shared one.
     *
     * `NULL` is the whole history of every non-localized content type and the
     * *shared* history of a localized one, which is why it is the column default
     * in effect: a nullable column with no default backfills every pre-Stage-5B
     * row to exactly the right value in one statement.
     *
     * Deliberately **not** a foreign key, for the same reason there is none to
     * the record: a revision is an audit trail, and "the Polish copy said this"
     * stays true after the language row is gone. A cascade would erase the fact
     * and a restrict would block a language deletion the *translation* table has
     * already had its say about. The snapshot carries the locale code, so a
     * revision remains readable without the language it names.
     */
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
    /**
     * Set only on a `restore`. Intentionally **not** a foreign key: retention
     * may prune the revision it names, and "restored from v7" is still true
     * afterwards - a cascade would erase the fact, and a restrict would block
     * pruning.
     */
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
).enableRLS();

export type ContentRevisionRow = typeof core_content_revisions.$inferSelect;

/**
 * Pending and past scheduled transitions, for content types with
 * `editorial.scheduling`.
 *
 * Shared and foreign-key-free for exactly the same reasons as
 * {@link core_content_revisions}, and scoped by the same three columns on every
 * query.
 *
 * Completed and cancelled rows are **kept**: "who scheduled this, and when did
 * it go out" is the audit trail the feature exists to provide, and deleting it
 * the moment it succeeds would answer that question with silence. A daily core
 * cron sweeps them past `CONTENT_SCHEDULE_RETENTION_DAYS`.
 */
export const core_content_schedules = pgTable(
  "core_content_schedules",
  t => ({
    id: t.serial().primaryKey(),
    pluginId: t.varchar({ length: 255 }).notNull(),
    contentTypeId: t.varchar({ length: 100 }).notNull(),
    itemId: t.integer().notNull(),
    action: t.varchar({ enum: CONTENT_SCHEDULE_ACTIONS, length: 16 }).notNull(),
    scheduledFor: t.timestamp().notNull(),
    /**
     * Bumped every time this `(item, action)` is rescheduled.
     *
     * The queued task carries the generation it was dispatched with, so a task
     * left over from a previous schedule finds a mismatch and quietly does
     * nothing. That is cheaper and far more reliable than trying to hunt down
     * and delete the old queue row.
     */
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
    /**
     * Why a *completed* schedule's announcements have not been delivered.
     *
     * The transition and its effects are two units of work on purpose, so they
     * need two error fields. A value here means the record published exactly
     * once and the event, search write or cache invalidation is still being
     * retried by the `content-schedule-effects` task - never that the
     * publication should run again.
     */
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
).enableRLS();

export type ContentScheduleRow = typeof core_content_schedules.$inferSelect;

/** Re-exported so `src/database` consumers need not reach into `content/`. */
export type {
  ContentAnyRevisionSnapshot,
  ContentRevisionSnapshot,
  ContentSnapshotValue,
  ContentTranslationRevisionSnapshot,
};
