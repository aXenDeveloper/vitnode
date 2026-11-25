import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";
import {
  camelCase,
  check,
  index,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";

import type { RichTextDocument } from "@/content/rich-text/document";
import type { MultiLangValue } from "@/lib/helpers/multi-lang";

import { LEGAL_DOCUMENT_TYPES } from "@/lib/legal/contract";

import { core_users } from "./users";

/**
 * One announced version of a legal document. Rows are immutable: content,
 * translations, summary, effective date and acceptance mode never change after
 * the insert (a database trigger enforces it), so a fix or reversion is a new
 * version. `version` counts up per document type from 1.
 */
export const core_legal_versions = camelCase.table.withRLS(
  "core_legal_versions",
  t => ({
    id: t.serial().primaryKey(),
    documentType: t
      .varchar({ enum: LEGAL_DOCUMENT_TYPES, length: 20 })
      .notNull(),
    version: t.integer().notNull(),
    title: t.jsonb().$type<MultiLangValue>().notNull(),
    body: t.jsonb().$type<MultiLangValue<RichTextDocument>>().notNull(),
    summary: t.jsonb().$type<MultiLangValue>().notNull().default([]),
    acceptanceLabel: t.jsonb().$type<MultiLangValue>().notNull().default([]),
    /** The site's default language at publication: the fallback for missing translations. */
    defaultLanguageCode: t.varchar({ length: 32 }).notNull(),
    /** Only Terms may require it; the first Terms version always does. */
    requiresAcceptance: t.boolean().notNull().default(false),
    announcedAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
    effectiveAt: t.timestamp({ withTimezone: true }).notNull(),
    /** SHA-256 of the stored content, so an export can prove what was shown. */
    contentHash: t.varchar({ length: 64 }).notNull(),
    basedOnVersionId: t
      .integer()
      .references((): AnyPgColumn => core_legal_versions.id),
    publishedById: t
      .integer()
      .references(() => core_users.id, { onDelete: "set null" }),
  }),
  t => [
    unique("core_legal_versions_type_version_unique").on(
      t.documentType,
      t.version,
    ),
    index("core_legal_versions_type_effective_idx").on(
      t.documentType,
      t.effectiveAt,
    ),
    check(
      "core_legal_versions_acceptance_terms_only",
      sql`${t.requiresAcceptance} = false OR ${t.documentType} = 'terms'`,
    ),
    check("core_legal_versions_version_positive", sql`${t.version} > 0`),
  ],
);

/**
 * The working copy staff edit before announcing it: at most one per document
 * type. Announcing copies it into {@link core_legal_versions} and deletes it.
 */
export const core_legal_drafts = camelCase.table.withRLS(
  "core_legal_drafts",
  t => ({
    documentType: t
      .varchar({ enum: LEGAL_DOCUMENT_TYPES, length: 20 })
      .primaryKey(),
    basedOnVersionId: t
      .integer()
      .references(() => core_legal_versions.id, { onDelete: "set null" }),
    title: t.jsonb().$type<MultiLangValue>().notNull().default([]),
    body: t
      .jsonb()
      .$type<MultiLangValue<RichTextDocument>>()
      .notNull()
      .default([]),
    summary: t.jsonb().$type<MultiLangValue>().notNull().default([]),
    acceptanceLabel: t.jsonb().$type<MultiLangValue>().notNull().default([]),
    requiresAcceptance: t.boolean().notNull().default(false),
    /** The planned effective time; chosen again when announcing. */
    effectiveAt: t.timestamp({ withTimezone: true }),
    /** Bumped on every save, so two editors cannot overwrite each other. */
    revision: t.integer().notNull().default(1),
    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdById: t
      .integer()
      .references(() => core_users.id, { onDelete: "set null" }),
    updatedAt: t
      .timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    updatedById: t
      .integer()
      .references(() => core_users.id, { onDelete: "set null" }),
  }),
);

export const LEGAL_ACCEPTANCE_SOURCES = ["signup", "gate"] as const;

/**
 * Append-only Terms acceptances: one row per member and exact version, with
 * the server time, the locale of the snapshot shown and the checkbox wording
 * accepted. Erased with the account.
 */
export const core_legal_acceptances = camelCase.table.withRLS(
  "core_legal_acceptances",
  t => ({
    id: t.serial().primaryKey(),
    userId: t
      .integer()
      .references(() => core_users.id, { onDelete: "cascade" })
      .notNull(),
    versionId: t
      .integer()
      .references(() => core_legal_versions.id)
      .notNull(),
    acceptedAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
    locale: t.varchar({ length: 32 }).notNull(),
    wording: t.text().notNull(),
    source: t.varchar({ enum: LEGAL_ACCEPTANCE_SOURCES, length: 16 }).notNull(),
  }),
  t => [
    unique("core_legal_acceptances_user_version_unique").on(
      t.userId,
      t.versionId,
    ),
    index("core_legal_acceptances_version_idx").on(t.versionId),
  ],
);

/**
 * A member dismissed the informational notice of one version. Never counts as
 * acceptance. Erased with the account.
 */
export const core_legal_notice_dismissals = camelCase.table.withRLS(
  "core_legal_notice_dismissals",
  t => ({
    userId: t
      .integer()
      .references(() => core_users.id, { onDelete: "cascade" })
      .notNull(),
    versionId: t
      .integer()
      .references(() => core_legal_versions.id)
      .notNull(),
    dismissedAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
  }),
  t => [primaryKey({ columns: [t.userId, t.versionId] })],
);

export const LEGAL_DELIVERY_STATUSES = [
  "pending",
  "sending",
  "sent",
  "failed",
  "skipped",
] as const;

export type LegalDeliveryStatus = (typeof LEGAL_DELIVERY_STATUSES)[number];

export const LEGAL_DELIVERY_SKIP_REASONS = [
  "no_address",
  "unverified",
  "deleted",
] as const;

export type LegalDeliverySkipReason =
  (typeof LEGAL_DELIVERY_SKIP_REASONS)[number];

/**
 * The announcement email of one version to one member: the durable delivery
 * key is `(versionId, userId)`. `sent` means the provider accepted the
 * message, not that it reached the mailbox. Erased with the account.
 */
export const core_legal_deliveries = camelCase.table.withRLS(
  "core_legal_deliveries",
  t => ({
    id: t.serial().primaryKey(),
    versionId: t
      .integer()
      .references(() => core_legal_versions.id)
      .notNull(),
    userId: t
      .integer()
      .references(() => core_users.id, { onDelete: "cascade" })
      .notNull(),
    status: t
      .varchar({ enum: LEGAL_DELIVERY_STATUSES, length: 16 })
      .notNull()
      .default("pending"),
    skipReason: t.varchar({ enum: LEGAL_DELIVERY_SKIP_REASONS, length: 16 }),
    attempts: t.integer().notNull().default(0),
    lastError: t.text(),
    providerMessageId: t.varchar({ length: 255 }),
    nextAttemptAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastAttemptAt: t.timestamp({ withTimezone: true }),
    sentAt: t.timestamp({ withTimezone: true }),
    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: t
      .timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [
    unique("core_legal_deliveries_version_user_unique").on(
      t.versionId,
      t.userId,
    ),
    index("core_legal_deliveries_version_status_idx").on(
      t.versionId,
      t.status,
      t.nextAttemptAt,
    ),
    index("core_legal_deliveries_user_idx").on(t.userId),
  ],
);

export const LEGAL_FANOUT_STATUSES = [
  "pending",
  "running",
  "completed",
] as const;

/**
 * Progress of one version's announcement fan-out: written in the same
 * transaction as the version, then advanced batch by batch from the queue.
 * `incidentAt` is set while the email provider keeps failing.
 */
export const core_legal_fanouts = camelCase.table.withRLS(
  "core_legal_fanouts",
  t => ({
    versionId: t
      .integer()
      .primaryKey()
      .references(() => core_legal_versions.id),
    status: t
      .varchar({ enum: LEGAL_FANOUT_STATUSES, length: 16 })
      .notNull()
      .default("pending"),
    /** Members are added in id order; the last id added. */
    cursorUserId: t.integer().notNull().default(0),
    /** Members created after this time are not recipients. */
    recipientsCreatedBefore: t.timestamp().notNull(),
    incidentAt: t.timestamp({ withTimezone: true }),
    lastError: t.text(),
    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
    completedAt: t.timestamp({ withTimezone: true }),
    updatedAt: t
      .timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
);
