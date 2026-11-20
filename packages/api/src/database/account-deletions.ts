import { sql } from "drizzle-orm";
import { camelCase, index, uniqueIndex } from "drizzle-orm/pg-core";

import { core_users } from "./users";

export const ACCOUNT_DELETION_STATUSES = [
  "pending",
  "completed",
  "cancelled",
  "failed",
] as const;

export type AccountDeletionStatus = (typeof ACCOUNT_DELETION_STATUSES)[number];

export const ACCOUNT_DELETION_SOURCES = ["user", "admin"] as const;

export type AccountDeletionSource = (typeof ACCOUNT_DELETION_SOURCES)[number];

/**
 * One request to erase an account (GDPR Art. 17). The row outlives the
 * account on purpose: it is the proof that the request was handled, and it
 * holds no personal data - only the erased id, which no longer resolves to
 * anyone, so restoring an old backup can replay the erasure.
 */
export const core_users_deletions = camelCase.table.withRLS(
  "core_users_deletions",
  t => ({
    id: t.serial().primaryKey(),
    /** Set while the account exists; `null` once it is erased. */
    userId: t.integer().references(() => core_users.id, {
      onDelete: "set null",
    }),
    /** The account's id, kept after erasure as a tombstone. Not a foreign key. */
    erasedUserId: t.integer().notNull(),
    source: t.varchar({ enum: ACCOUNT_DELETION_SOURCES, length: 16 }).notNull(),
    requestedById: t.integer().references(() => core_users.id, {
      onDelete: "set null",
    }),
    status: t
      .varchar({ enum: ACCOUNT_DELETION_STATUSES, length: 16 })
      .notNull()
      .default("pending"),
    scheduledAt: t.timestamp().notNull(),
    attempts: t.integer().notNull().default(0),
    lastError: t.text(),
    filesDeleted: t.integer().notNull().default(0),
    filesKept: t.integer().notNull().default(0),
    createdAt: t.timestamp().notNull().defaultNow(),
    cancelledAt: t.timestamp(),
    completedAt: t.timestamp(),
  }),
  t => [
    // At most one open request per account.
    uniqueIndex("core_users_deletions_pending_user_unique")
      .on(t.userId)
      .where(sql`${t.status} = 'pending'`),
    index("core_users_deletions_status_scheduled_idx").on(
      t.status,
      t.scheduledAt,
    ),
    index("core_users_deletions_erased_user_idx").on(t.erasedUserId),
    index("core_users_deletions_created_at_id_idx").on(t.createdAt, t.id),
  ],
);
