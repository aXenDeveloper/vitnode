import { sql } from "drizzle-orm";
import { camelCase, index, unique, uniqueIndex } from "drizzle-orm/pg-core";

import type {
  SanctionSource,
  SanctionThresholdSnapshot,
  SanctionType,
  WarningContentSnapshot,
  WarningReasonSnapshot,
  WarningThresholdAction,
} from "@/lib/moderation/warnings";

import {
  SANCTION_SOURCES,
  SANCTION_TYPES,
  WARNING_THRESHOLD_ACTIONS,
} from "@/lib/moderation/warnings";

import { core_moderation_reports } from "./moderation";
import { core_users } from "./users";

/** Warning reasons. Their title, description and default message live in `core_languages_words`. */
export const core_moderation_warning_reasons = camelCase.table.withRLS(
  "core_moderation_warning_reasons",
  t => ({
    id: t.serial().primaryKey(),
    points: t.integer().notNull().default(0),
    /** `null` means the points never expire. */
    expiresAfterHours: t.integer(),
    enabled: t.boolean().notNull().default(true),
    position: t.integer().notNull().default(0),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [index("core_moderation_warning_reasons_position_idx").on(t.position)],
);

export const core_moderation_warning_thresholds = camelCase.table.withRLS(
  "core_moderation_warning_thresholds",
  t => ({
    id: t.serial().primaryKey(),
    points: t.integer().notNull(),
    action: t
      .varchar({ enum: WARNING_THRESHOLD_ACTIONS, length: 32 })
      .$type<WarningThresholdAction>()
      .notNull(),
    /** Length of a temporary suspension; `null` for an indefinite one. */
    durationHours: t.integer(),
    enabled: t.boolean().notNull().default(true),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [
    // Two enabled rules at the same points would be ambiguous.
    uniqueIndex("core_moderation_warning_thresholds_enabled_points_idx")
      .on(t.points)
      .where(sql`"enabled" = true`),
  ],
);

export const core_moderation_warnings = camelCase.table.withRLS(
  "core_moderation_warnings",
  t => ({
    id: t.serial().primaryKey(),
    userId: t
      .integer()
      .notNull()
      .references(() => core_users.id, { onDelete: "cascade" }),
    issuedById: t.integer().references(() => core_users.id, {
      onDelete: "set null",
    }),
    reasonId: t.integer().references(() => core_moderation_warning_reasons.id, {
      onDelete: "set null",
    }),
    reasonSnapshot: t.jsonb().$type<WarningReasonSnapshot>(),
    points: t.integer().notNull(),
    /** The reason's points when the warning was issued, for auditing overrides. */
    defaultPoints: t.integer(),
    /** Staff-only explanation of a points or expiration override. */
    overrideNote: t.text(),
    /** Shown to the warned member. */
    message: t.text().notNull(),
    /** Shown to staff with `can_view_notes` only. */
    staffNote: t.text(),
    issuedAt: t.timestamp().notNull().defaultNow(),
    /** When the points stop counting; `null` never. */
    expiresAt: t.timestamp(),
    /** Active points just before and after this warning, as the server computed them. */
    pointsBefore: t.integer().notNull().default(0),
    pointsAfter: t.integer().notNull().default(0),
    pluginId: t.varchar({ length: 100 }),
    targetType: t.varchar({ length: 100 }),
    targetId: t.varchar({ length: 64 }),
    scopeFamily: t.varchar({ length: 100 }),
    scopeId: t.varchar({ length: 64 }),
    contentSnapshot: t.jsonb().$type<WarningContentSnapshot>(),
    reportId: t.integer().references(() => core_moderation_reports.id, {
      onDelete: "set null",
    }),
    idempotencyKey: t.varchar({ length: 64 }),
    revokedAt: t.timestamp(),
    revokedById: t.integer().references(() => core_users.id, {
      onDelete: "set null",
    }),
    revokeReason: t.text(),
  }),
  t => [
    unique("core_moderation_warnings_idempotency_key").on(
      t.issuedById,
      t.idempotencyKey,
    ),
    index("core_moderation_warnings_user_idx").on(t.userId, t.issuedAt),
    index("core_moderation_warnings_issued_at_id_idx").on(t.issuedAt, t.id),
    index("core_moderation_warnings_issued_by_idx").on(t.issuedById),
    index("core_moderation_warnings_reason_idx").on(t.reasonId),
    index("core_moderation_warnings_target_idx").on(
      t.pluginId,
      t.targetType,
      t.targetId,
    ),
    index("core_moderation_warnings_report_idx").on(t.reportId),
  ],
);

export const core_moderation_sanctions = camelCase.table.withRLS(
  "core_moderation_sanctions",
  t => ({
    id: t.serial().primaryKey(),
    userId: t
      .integer()
      .notNull()
      .references(() => core_users.id, { onDelete: "cascade" }),
    type: t
      .varchar({ enum: SANCTION_TYPES, length: 32 })
      .$type<SanctionType>()
      .notNull(),
    source: t
      .varchar({ enum: SANCTION_SOURCES, length: 32 })
      .$type<SanctionSource>()
      .notNull(),
    startsAt: t.timestamp().notNull().defaultNow(),
    /** `null` for an indefinite sanction. */
    endsAt: t.timestamp(),
    /** The warning whose threshold evaluation created it - at most one per warning. */
    warningId: t
      .integer()
      .unique()
      .references(() => core_moderation_warnings.id, { onDelete: "set null" }),
    thresholdId: t
      .integer()
      .references(() => core_moderation_warning_thresholds.id, {
        onDelete: "set null",
      }),
    thresholdSnapshot: t.jsonb().$type<SanctionThresholdSnapshot>(),
    createdById: t.integer().references(() => core_users.id, {
      onDelete: "set null",
    }),
    createdAt: t.timestamp().notNull().defaultNow(),
    revokedAt: t.timestamp(),
    revokedById: t.integer().references(() => core_users.id, {
      onDelete: "set null",
    }),
    revokeReason: t.text(),
  }),
  t => [
    index("core_moderation_sanctions_user_idx").on(
      t.userId,
      t.revokedAt,
      t.endsAt,
    ),
    index("core_moderation_sanctions_created_at_id_idx").on(t.createdAt, t.id),
  ],
);
