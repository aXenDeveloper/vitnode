import { sql } from "drizzle-orm";
import { camelCase, index, uniqueIndex } from "drizzle-orm/pg-core";

import type {
  ContentSubmissionKind,
  ContentSubmissionStatus,
} from "../content/approvals/const";

import {
  CONTENT_SUBMISSION_KINDS,
  CONTENT_SUBMISSION_STATUSES,
} from "../content/approvals/const";
import { core_users } from "./users";

export const core_content_submissions = camelCase.table.withRLS(
  "core_content_submissions",
  t => ({
    id: t.serial().primaryKey(),
    pluginId: t.varchar({ length: 255 }).notNull(),
    contentTypeId: t.varchar({ length: 100 }).notNull(),
    itemId: t.varchar({ length: 64 }).notNull(),
    containerDefinitionId: t.varchar({ length: 100 }),
    containerId: t.integer(),
    kind: t
      .varchar({ enum: CONTENT_SUBMISSION_KINDS, length: 16 })
      .$type<ContentSubmissionKind>()
      .notNull(),
    status: t
      .varchar({ enum: CONTENT_SUBMISSION_STATUSES, length: 16 })
      .$type<ContentSubmissionStatus>()
      .notNull()
      .default("pending"),
    values: t.jsonb().$type<Record<string, unknown>>().notNull().default({}),
    baseValues: t.jsonb().$type<Record<string, unknown>>(),
    baseVersion: t.integer(),
    baseUpdatedAt: t.timestamp(),
    authorId: t.integer().references(() => core_users.id, {
      onDelete: "set null",
    }),
    reviewerId: t.integer().references(() => core_users.id, {
      onDelete: "set null",
    }),
    reason: t.text(),
    revisionId: t.integer(),
    decidedAt: t.timestamp(),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [
    uniqueIndex("core_content_submissions_pending_key")
      .on(t.contentTypeId, t.itemId)
      .where(sql`"status" = 'pending'`),
    index("core_content_submissions_queue_idx").on(
      t.status,
      t.contentTypeId,
      t.containerId,
      t.createdAt,
    ),
    index("core_content_submissions_item_idx").on(t.contentTypeId, t.itemId),
    index("core_content_submissions_author_idx").on(t.authorId, t.createdAt),
  ],
);
