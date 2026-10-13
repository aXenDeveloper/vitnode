import { camelCase, index } from "drizzle-orm/pg-core";

import type {
  ModerationReportEventType,
  ModerationReportReason,
  ModerationReportResolution,
  ModerationReportStatus,
} from "@/lib/moderation/const";
import type { ModerationReportSnapshot } from "@/lib/moderation/snapshot";

import {
  MODERATION_REPORT_EVENT_TYPES,
  MODERATION_REPORT_REASONS,
  MODERATION_REPORT_RESOLUTIONS,
  MODERATION_REPORT_STATUSES,
} from "@/lib/moderation/const";

import { core_users } from "./users";

export const core_moderation_reports = camelCase.table.withRLS(
  "core_moderation_reports",
  t => ({
    id: t.serial().primaryKey(),
    pluginId: t.varchar({ length: 100 }).notNull(),
    targetType: t.varchar({ length: 100 }).notNull(),
    targetId: t.varchar({ length: 64 }).notNull(),
    reporterId: t.integer().references(() => core_users.id, {
      onDelete: "set null",
    }),
    reason: t
      .varchar({ enum: MODERATION_REPORT_REASONS, length: 32 })
      .$type<ModerationReportReason>()
      .notNull(),
    description: t.text(),
    snapshot: t.jsonb().$type<ModerationReportSnapshot>().notNull(),
    targetTitle: t.varchar({ length: 500 }),
    status: t
      .varchar({ enum: MODERATION_REPORT_STATUSES, length: 20 })
      .$type<ModerationReportStatus>()
      .notNull()
      .default("new"),
    assigneeId: t.integer().references(() => core_users.id, {
      onDelete: "set null",
    }),
    resolution: t
      .varchar({ enum: MODERATION_REPORT_RESOLUTIONS, length: 32 })
      .$type<ModerationReportResolution>(),
    resolutionNote: t.text(),
    resolvedAt: t.timestamp(),
    resolvedById: t.integer().references(() => core_users.id, {
      onDelete: "set null",
    }),
    scopeFamily: t.varchar({ length: 100 }),
    scopeId: t.varchar({ length: 64 }),
    openKey: t.varchar({ length: 255 }).unique(),
    version: t.integer().notNull().default(1),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [
    index("core_moderation_reports_target_idx").on(
      t.pluginId,
      t.targetType,
      t.targetId,
    ),
    index("core_moderation_reports_status_idx").on(t.status, t.createdAt),
    index("core_moderation_reports_assignee_idx").on(t.assigneeId),
    index("core_moderation_reports_reporter_idx").on(t.reporterId, t.createdAt),
    index("core_moderation_reports_scope_idx").on(t.scopeFamily, t.scopeId),
  ],
);

export const core_moderation_report_events = camelCase.table.withRLS(
  "core_moderation_report_events",
  t => ({
    id: t.serial().primaryKey(),
    reportId: t
      .integer()
      .notNull()
      .references(() => core_moderation_reports.id, { onDelete: "cascade" }),
    type: t
      .varchar({ enum: MODERATION_REPORT_EVENT_TYPES, length: 32 })
      .$type<ModerationReportEventType>()
      .notNull(),
    actorId: t.integer().references(() => core_users.id, {
      onDelete: "set null",
    }),
    data: t.jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [index("core_moderation_report_events_report_idx").on(t.reportId, t.id)],
);
