import { sql } from "drizzle-orm";
import { camelCase, index, uniqueIndex } from "drizzle-orm/pg-core";

import type { RichTextDocument } from "../content/rich-text/document";

import { CONTENT_ID_KEY_LENGTH } from "../content/const";
import { core_users } from "./users";

const money = { precision: 24, scale: 12 } as const;

/**
 * Machine translations of public records, shared by every reader. Kept apart
 * from the editorial `{table}_translations` tables, so they never get a
 * publication status, a localized slug or a sitemap entry.
 *
 * One row per target (`targetKind` + `contentTypeId` + `recordId`), field,
 * source fingerprint and language. A row is never rewritten: a new source
 * version is a new fingerprint and a new row.
 */
export const core_content_ai_translations = camelCase.table.withRLS(
  "core_content_ai_translations",
  t => ({
    id: t.serial().primaryKey(),
    targetKind: t.varchar({ length: 20 }).notNull().default("content"),
    contentTypeId: t.varchar({ length: 150 }).notNull(),
    recordId: t.varchar({ length: CONTENT_ID_KEY_LENGTH }).notNull(),
    field: t.varchar({ length: 100 }).notNull(),
    sourceFingerprint: t.varchar({ length: 64 }).notNull(),
    targetLocale: t.varchar({ length: 32 }).notNull(),
    sourceLocale: t.varchar({ length: 32 }),
    value: t.jsonb().$type<RichTextDocument | string>().notNull(),
    runId: t.integer(),
    modelId: t.varchar({ length: 100 }),
    promptVersion: t.integer().notNull(),
    createdAt: t.timestamp().notNull().defaultNow(),
    supersededAt: t.timestamp(),
  }),
  t => [
    uniqueIndex("core_content_ai_translations_key_unique").on(
      t.targetKind,
      t.contentTypeId,
      t.recordId,
      t.field,
      t.sourceFingerprint,
      t.targetLocale,
    ),
    index("core_content_ai_translations_record_idx").on(
      t.contentTypeId,
      t.recordId,
    ),
    index("core_content_ai_translations_superseded_idx")
      .on(t.supersededAt)
      .where(sql`"supersededAt" IS NOT NULL`),
  ],
);

export const CONTENT_AI_TRANSLATION_JOB_STATUSES = [
  "pending",
  "running",
  "completed",
  "skipped",
  "failed",
  "waiting_budget",
] as const;

/**
 * One translation job per key, whatever its state, so two readers or two API
 * instances can never start the same work twice. Claims are conditional
 * updates under a lease; the queue row that carries the job is only transport.
 */
export const core_content_ai_translation_jobs = camelCase.table.withRLS(
  "core_content_ai_translation_jobs",
  t => ({
    id: t.serial().primaryKey(),
    targetKind: t.varchar({ length: 20 }).notNull().default("content"),
    contentTypeId: t.varchar({ length: 150 }).notNull(),
    recordId: t.varchar({ length: CONTENT_ID_KEY_LENGTH }).notNull(),
    field: t.varchar({ length: 100 }).notNull(),
    sourceFingerprint: t.varchar({ length: 64 }).notNull(),
    targetLocale: t.varchar({ length: 32 }).notNull(),
    mode: t
      .varchar({ enum: ["automatic", "manual"], length: 10 })
      .notNull()
      .default("automatic"),
    sourceLocaleHint: t.varchar({ length: 32 }),
    status: t
      .varchar({ enum: CONTENT_AI_TRANSLATION_JOB_STATUSES, length: 20 })
      .notNull()
      .default("pending"),
    reason: t.varchar({ length: 40 }),
    attempts: t.integer().notNull().default(0),
    maxAttempts: t.integer().notNull().default(3),
    availableAt: t.timestamp().notNull().defaultNow(),
    leaseOwner: t.varchar({ length: 36 }),
    leaseExpiresAt: t.timestamp(),
    requestedBy: t.integer().references(() => core_users.id, {
      onDelete: "set null",
    }),
    requestedAt: t.timestamp().notNull().defaultNow(),
    completedAt: t.timestamp(),
    runId: t.integer(),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [
    uniqueIndex("core_content_ai_translation_jobs_key_unique").on(
      t.targetKind,
      t.contentTypeId,
      t.recordId,
      t.field,
      t.sourceFingerprint,
      t.targetLocale,
    ),
    index("core_content_ai_translation_jobs_status_idx").on(
      t.status,
      t.availableAt,
    ),
    index("core_content_ai_translation_jobs_requester_idx").on(
      t.requestedBy,
      t.requestedAt,
    ),
  ],
);

/**
 * The language detected for a text, memoized by the fingerprint of its plain
 * text, so the detector runs once per distinct text. No AI is involved.
 */
export const core_content_language_detections = camelCase.table.withRLS(
  "core_content_language_detections",
  t => ({
    textFingerprint: t.varchar({ length: 64 }).primaryKey(),
    locale: t.varchar({ length: 32 }),
    confident: t.boolean().notNull(),
    detectorVersion: t.integer().notNull(),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
);

/** Site-wide settings of automatic translation. A single row, `id = 1`. */
export const core_content_translation_settings = camelCase.table.withRLS(
  "core_content_translation_settings",
  t => ({
    id: t.integer().primaryKey().default(1),
    enabled: t.boolean().notNull().default(true),
    locales: t
      .jsonb()
      .$type<string[]>()
      .notNull()
      .default(sql`'["en","pl"]'::jsonb`),
    monthlyBudgetUsd: t.numeric(money).default("5"),
    userHourlyLimit: t.integer().notNull().default(100),
    retentionDays: t.integer().notNull().default(30),
    cleanupCursor: t.integer().notNull().default(0),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
);
