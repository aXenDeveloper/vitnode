import { sql } from "drizzle-orm";
import { camelCase, index, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";

import type { NotificationEmailMode } from "@/lib/notifications/types";

import { core_users } from "./users";

export const core_notification_events = camelCase.table.withRLS(
  "core_notification_events",
  t => ({
    id: t.bigserial({ mode: "number" }).primaryKey(),
    pluginId: t.varchar({ length: 100 }).notNull(),
    type: t.varchar({ length: 100 }).notNull(),
    schemaVersion: t.integer().notNull().default(1),
    idempotencyKey: t.varchar({ length: 255 }).notNull(),
    actorId: t.integer().references(() => core_users.id, {
      onDelete: "set null",
    }),
    subjectType: t.varchar({ length: 100 }),
    subjectId: t.varchar({ length: 100 }),
    groupKey: t.varchar({ length: 255 }),
    data: t.jsonb().$type<Record<string, unknown>>().notNull().default({}),
    recipientIds: t
      .integer()
      .array()
      .notNull()
      .default(sql`'{}'::integer[]`),
    allowSelf: t.boolean().notNull().default(false),
    status: t
      .varchar({
        enum: ["pending", "processing", "completed", "failed"],
        length: 20,
      })
      .notNull()
      .default("pending"),
    recipientCursor: t.integer().notNull().default(0),
    deliveredCount: t.integer().notNull().default(0),
    lastError: t.text(),
    createdAt: t.timestamp().notNull().defaultNow(),
    completedAt: t.timestamp(),
  }),
  t => [
    uniqueIndex("core_notification_events_idempotency_unique").on(
      t.pluginId,
      t.type,
      t.idempotencyKey,
    ),
    index("core_notification_events_status_idx").on(t.status, t.id),
    index("core_notification_events_created_at_idx").on(t.createdAt),
  ],
);

export const core_notifications = camelCase.table.withRLS(
  "core_notifications",
  t => ({
    id: t.bigserial({ mode: "number" }).primaryKey(),
    userId: t
      .integer()
      .references(() => core_users.id, { onDelete: "cascade" })
      .notNull(),
    pluginId: t.varchar({ length: 100 }).notNull(),
    type: t.varchar({ length: 100 }).notNull(),
    category: t.varchar({ length: 50 }).notNull(),
    groupKey: t.varchar({ length: 255 }).notNull(),
    groupBucket: t.bigint({ mode: "number" }).notNull().default(0),
    subjectType: t.varchar({ length: 100 }),
    subjectId: t.varchar({ length: 100 }),
    latestEventId: t
      .bigint({ mode: "number" })
      .references(() => core_notification_events.id, { onDelete: "restrict" })
      .notNull(),
    eventCount: t.integer().notNull().default(1),
    activitySeq: t.integer().notNull().default(1),
    readSeq: t.integer().notNull().default(0),
    readAt: t.timestamp(),
    archivedAt: t.timestamp(),
    createdAt: t.timestamp().notNull().defaultNow(),
    lastActivityAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    uniqueIndex("core_notifications_group_unique").on(
      t.userId,
      t.pluginId,
      t.type,
      t.groupKey,
      t.groupBucket,
    ),
    index("core_notifications_inbox_idx")
      .on(t.userId, t.lastActivityAt.desc(), t.id.desc())
      .where(sql`"archivedAt" IS NULL`),
    index("core_notifications_unread_idx")
      .on(t.userId, t.lastActivityAt.desc(), t.id.desc())
      .where(sql`"archivedAt" IS NULL AND "readSeq" < "activitySeq"`),
    index("core_notifications_subject_idx").on(t.subjectType, t.subjectId),
    index("core_notifications_last_activity_idx").on(t.lastActivityAt),
    index("core_notifications_latest_event_idx").on(t.latestEventId),
  ],
);

export const core_notification_receipts = camelCase.table.withRLS(
  "core_notification_receipts",
  t => ({
    eventId: t
      .bigint({ mode: "number" })
      .references(() => core_notification_events.id, { onDelete: "cascade" })
      .notNull(),
    userId: t
      .integer()
      .references(() => core_users.id, { onDelete: "cascade" })
      .notNull(),
    notificationId: t
      .bigint({ mode: "number" })
      .references(() => core_notifications.id, { onDelete: "cascade" }),
    seq: t.integer(),
    emailPending: t.boolean().notNull().default(false),
    emailDeliveryId: t.bigint({ mode: "number" }),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    primaryKey({ columns: [t.eventId, t.userId] }),
    index("core_notification_receipts_notification_idx").on(
      t.notificationId,
      t.seq,
    ),
    index("core_notification_receipts_user_idx").on(t.userId),
    index("core_notification_receipts_email_pending_idx")
      .on(t.userId, t.createdAt)
      .where(sql`"emailPending" = true AND "emailDeliveryId" IS NULL`),
  ],
);

export interface NotificationTypePreference {
  email?: NotificationEmailMode;
  inApp?: boolean;
  push?: boolean;
}

export const core_notification_user_state = camelCase.table.withRLS(
  "core_notification_user_state",
  t => ({
    userId: t
      .integer()
      .primaryKey()
      .references(() => core_users.id, { onDelete: "cascade" }),
    unreadCount: t.integer().notNull().default(0),
    revision: t.bigint({ mode: "number" }).notNull().default(0),
    preferences: t
      .jsonb()
      .$type<Record<string, NotificationTypePreference>>()
      .notNull()
      .default({}),
    updatedAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [index("core_notification_user_state_unread_idx").on(t.unreadCount)],
);

export const core_notification_deliveries = camelCase.table.withRLS(
  "core_notification_deliveries",
  t => ({
    id: t.bigserial({ mode: "number" }).primaryKey(),
    userId: t
      .integer()
      .references(() => core_users.id, { onDelete: "cascade" })
      .notNull(),
    channel: t.varchar({ enum: ["email"], length: 20 }).notNull(),
    mode: t
      .varchar({ enum: ["immediate", "daily", "weekly", "test"], length: 20 })
      .notNull(),
    eventId: t
      .bigint({ mode: "number" })
      .references(() => core_notification_events.id, { onDelete: "set null" }),
    idempotencyKey: t.varchar({ length: 255 }).notNull().unique(),
    status: t
      .varchar({
        enum: ["pending", "sending", "sent", "failed", "skipped"],
        length: 20,
      })
      .notNull()
      .default("pending"),
    attempts: t.integer().notNull().default(0),
    maxAttempts: t.integer().notNull().default(5),
    availableAt: t.timestamp().notNull().defaultNow(),
    periodStart: t.timestamp(),
    periodEnd: t.timestamp(),
    itemCount: t.integer().notNull().default(0),
    providerMessageId: t.varchar({ length: 255 }),
    lastError: t.varchar({ length: 500 }),
    skipReason: t.varchar({ length: 50 }),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t.timestamp().notNull().defaultNow(),
    sentAt: t.timestamp(),
  }),
  t => [
    index("core_notification_deliveries_claim_idx")
      .on(t.availableAt, t.id)
      .where(sql`status = 'pending'`),
    index("core_notification_deliveries_status_idx").on(t.status, t.id),
    index("core_notification_deliveries_user_idx").on(t.userId),
  ],
);

export const core_notification_settings = camelCase.table.withRLS(
  "core_notification_settings",
  t => ({
    key: t.varchar({ length: 255 }).primaryKey(),
    value: t.jsonb().$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: t.timestamp().notNull().defaultNow(),
  }),
);
