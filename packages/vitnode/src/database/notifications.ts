import { sql } from "drizzle-orm";
import { camelCase, index, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";

import type { NotificationEmailMode } from "@/lib/notifications/types";

import { core_users } from "./users";

/**
 * One published notification event, stored once however many people receive
 * it. `recipientIds` and `followersOf` are the candidates the publisher named;
 * the fan-out cursor records how far delivery got, so a retry resumes there.
 */
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
    followersOf: t
      .jsonb()
      .$type<{ id: string; type: string }[]>()
      .notNull()
      .default([]),
    allowSelf: t.boolean().notNull().default(false),
    status: t
      .varchar({
        enum: ["pending", "processing", "completed", "failed"],
        length: 20,
      })
      .notNull()
      .default("pending"),
    /** Index into `recipientIds` processed so far. */
    recipientCursor: t.integer().notNull().default(0),
    /** Index into `followersOf` currently being streamed. */
    followerSubjectCursor: t.integer().notNull().default(0),
    /** Last follower user id processed within that subject. */
    followerUserCursor: t.integer().notNull().default(0),
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

/**
 * A recipient's inbox entry. Ungrouped events get one row each; grouped events
 * share one row per recipient, type, group key and time bucket. Unread means
 * `readSeq < activitySeq` on a row that is not archived.
 */
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
    // Restrict, not cascade: deleting an event must never drop unread items
    // behind the counter's back. Cleanup removes items first, then events.
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

/**
 * One row per event and recipient: the deduplication key for fan-out, the
 * membership of an event in a grouped inbox item, and the email state of that
 * event for that person.
 */
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
    /** `null` when the user takes this type by email only. */
    notificationId: t
      .bigint({ mode: "number" })
      .references(() => core_notifications.id, { onDelete: "cascade" }),
    /** `activitySeq` of the inbox item right after this event joined it. */
    seq: t.integer(),
    /** Waiting for an email (immediate or digest) that has not claimed it. */
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
}

/**
 * Everything notifications keep per user in one row: the canonical unread
 * count and its revision, digest schedule, and per-type preferences. Every
 * inbox write locks this row first, which serializes a user's inbox changes.
 */
export const core_notification_user_state = camelCase.table.withRLS(
  "core_notification_user_state",
  t => ({
    userId: t
      .integer()
      .primaryKey()
      .references(() => core_users.id, { onDelete: "cascade" }),
    unreadCount: t.integer().notNull().default(0),
    revision: t.bigint({ mode: "number" }).notNull().default(0),
    timeZone: t.varchar({ length: 64 }),
    digestHour: t.smallint().notNull().default(8),
    /** 0 = Sunday ... 6 = Saturday. */
    digestWeekday: t.smallint().notNull().default(1),
    preferences: t
      .jsonb()
      .$type<Record<string, NotificationTypePreference>>()
      .notNull()
      .default({}),
    updatedAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [index("core_notification_user_state_unread_idx").on(t.unreadCount)],
);

/** A user following or muting one subject, such as a blog category. */
export const core_notification_subscriptions = camelCase.table.withRLS(
  "core_notification_subscriptions",
  t => ({
    userId: t
      .integer()
      .references(() => core_users.id, { onDelete: "cascade" })
      .notNull(),
    subjectType: t.varchar({ length: 100 }).notNull(),
    subjectId: t.varchar({ length: 100 }).notNull(),
    state: t.varchar({ enum: ["following", "muted"], length: 20 }).notNull(),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    primaryKey({ columns: [t.userId, t.subjectType, t.subjectId] }),
    index("core_notification_subscriptions_subject_idx").on(
      t.subjectType,
      t.subjectId,
      t.state,
      t.userId,
    ),
  ],
);

/** One email send - immediate, digest or test - and its attempts. */
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

/** Installation policy: `global`, and one `type:{typeId}` per type. */
export const core_notification_settings = camelCase.table.withRLS(
  "core_notification_settings",
  t => ({
    key: t.varchar({ length: 255 }).primaryKey(),
    value: t.jsonb().$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: t.timestamp().notNull().defaultNow(),
  }),
);
