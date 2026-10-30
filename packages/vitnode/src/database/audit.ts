import { camelCase, index } from "drizzle-orm/pg-core";

import type { AuditChanges } from "@/lib/audit/const";

import {
  AUDIT_ACTION_MAX_LENGTH,
  AUDIT_ACTOR_TYPES,
  AUDIT_AREAS,
  AUDIT_DEFAULT_RETENTION_DAYS,
  AUDIT_PLUGIN_ID_MAX_LENGTH,
  AUDIT_SCOPE_FAMILY_MAX_LENGTH,
  AUDIT_SCOPE_ID_MAX_LENGTH,
  AUDIT_TARGET_ID_MAX_LENGTH,
  AUDIT_TARGET_LABEL_MAX_LENGTH,
  AUDIT_TARGET_TYPE_MAX_LENGTH,
} from "@/lib/audit/const";

import { core_users } from "./users";

/**
 * The append-only history of administrative, moderation, plugin and Content
 * Engine operations - who did what, when, to which resource.
 *
 * Deliberately separate from `core_logs` (technical warnings and errors) and
 * from `core_content_revisions` (what a record's content used to be). Nothing
 * here cascades from the resources it describes: `pluginId`, `targetType`,
 * `targetId` and `targetLabel` are plain text, so an entry outlives the record,
 * the content type and the plugin it names. Only the actor is a foreign key,
 * set to `null` when the account is deleted; `actorName` keeps the name the
 * entry was written under.
 */
export const core_audit_logs = camelCase.table.withRLS(
  "core_audit_logs",
  t => ({
    id: t.bigserial({ mode: "number" }).primaryKey(),
    pluginId: t.varchar({ length: AUDIT_PLUGIN_ID_MAX_LENGTH }).notNull(),
    area: t.varchar({ enum: AUDIT_AREAS, length: 16 }).notNull(),
    action: t.varchar({ length: AUDIT_ACTION_MAX_LENGTH }).notNull(),
    actorType: t.varchar({ enum: AUDIT_ACTOR_TYPES, length: 16 }).notNull(),
    actorId: t.integer().references(() => core_users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    actorName: t.varchar({ length: 255 }),
    targetType: t.varchar({ length: AUDIT_TARGET_TYPE_MAX_LENGTH }).notNull(),
    targetId: t.varchar({ length: AUDIT_TARGET_ID_MAX_LENGTH }),
    targetLabel: t.varchar({ length: AUDIT_TARGET_LABEL_MAX_LENGTH }),
    changes: t.jsonb().$type<AuditChanges>(),
    metadata: t.jsonb().$type<Record<string, unknown>>().notNull().default({}),
    contentTypeId: t.varchar({ length: 100 }),
    /** Not a foreign key: revisions are pruned by their own retention. */
    revisionId: t.integer(),
    scopeFamily: t.varchar({ length: AUDIT_SCOPE_FAMILY_MAX_LENGTH }),
    scopeId: t.varchar({ length: AUDIT_SCOPE_ID_MAX_LENGTH }),
    ipAddress: t.varchar({ length: 45 }),
    /** One id per request or background run, shared by every entry it wrote. */
    correlationId: t.varchar({ length: 64 }),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    // Newest first, date ranges and the retention sweep.
    index("core_audit_logs_created_at_id_idx").on(t.createdAt, t.id),
    index("core_audit_logs_actor_idx").on(t.actorId, t.createdAt),
    index("core_audit_logs_plugin_idx").on(t.pluginId, t.createdAt),
    index("core_audit_logs_action_idx").on(t.action, t.createdAt),
    index("core_audit_logs_area_idx").on(t.area, t.createdAt),
    // One entity's history.
    index("core_audit_logs_target_idx").on(
      t.pluginId,
      t.targetType,
      t.targetId,
      t.createdAt,
    ),
    // A scoped moderator's view.
    index("core_audit_logs_scope_idx").on(
      t.scopeFamily,
      t.scopeId,
      t.createdAt,
    ),
  ],
);

/**
 * The Activity Logs settings, one row (`id = 1`). Absent until an admin first
 * saves them, so every reader falls back to the defaults.
 */
export const core_audit_settings = camelCase.table.withRLS(
  "core_audit_settings",
  t => ({
    id: t.integer().primaryKey().default(1),
    /** Days an entry is kept. `0` keeps everything. */
    retentionDays: t.integer().notNull().default(AUDIT_DEFAULT_RETENTION_DAYS),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
);
