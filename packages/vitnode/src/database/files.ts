import { sql } from "drizzle-orm";
import { camelCase, index, uniqueIndex } from "drizzle-orm/pg-core";

import { core_ai_runs } from "./ai";
import { core_languages } from "./languages";
import { core_users } from "./users";

export const core_files = camelCase.table.withRLS(
  "core_files",
  t => ({
    id: t.serial().primaryKey(),
    name: t.varchar({ length: 255 }).notNull(),
    key: t.varchar({ length: 512 }).notNull().unique(),
    folder: t.varchar({ length: 255 }).notNull(),
    mimeType: t.varchar({ length: 255 }),
    size: t.integer().notNull().default(0),
    userId: t.integer().references(() => core_users.id, {
      onDelete: "set null",
    }),
    pluginId: t.varchar({ length: 100 }),
    metadata: t.jsonb().$type<Record<string, unknown>>().notNull().default({}),
    fingerprint: t.varchar({ length: 64 }),
    altPolicy: t
      .varchar({ enum: ["automatic", "manual", "disabled"], length: 16 })
      .notNull()
      .default("automatic"),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    index("core_files_user_id_idx").on(t.userId),
    index("core_files_created_at_id_idx").on(t.createdAt, t.id),
  ],
);

export const core_files_alt = camelCase.table.withRLS(
  "core_files_alt",
  t => ({
    id: t.serial().primaryKey(),
    fileId: t
      .integer()
      .notNull()
      .references(() => core_files.id, { onDelete: "cascade" }),
    languageCode: t
      .varchar({ length: 32 })
      .notNull()
      .references(() => core_languages.code, { onDelete: "cascade" }),
    text: t.text().notNull(),
    origin: t.varchar({ enum: ["ai", "human"], length: 10 }).notNull(),
    fileFingerprint: t.varchar({ length: 64 }),
    runId: t.integer().references(() => core_ai_runs.id, {
      onDelete: "set null",
    }),
    updatedById: t.integer().references(() => core_users.id, {
      onDelete: "set null",
    }),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [
    uniqueIndex("core_files_alt_file_language_unique").on(
      t.fileId,
      t.languageCode,
    ),
  ],
);

export const core_files_alt_analysis = camelCase.table.withRLS(
  "core_files_alt_analysis",
  t => ({
    id: t.serial().primaryKey(),
    fileId: t
      .integer()
      .notNull()
      .references(() => core_files.id, { onDelete: "cascade" }),
    fileFingerprint: t.varchar({ length: 64 }).notNull(),
    description: t.text().notNull(),
    runId: t.integer().references(() => core_ai_runs.id, {
      onDelete: "set null",
    }),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    uniqueIndex("core_files_alt_analysis_file_unique").on(
      t.fileId,
      t.fileFingerprint,
    ),
  ],
);

export const core_files_alt_state = camelCase.table.withRLS(
  "core_files_alt_state",
  t => ({
    fileId: t
      .integer()
      .primaryKey()
      .references(() => core_files.id, { onDelete: "cascade" }),
    status: t
      .varchar({
        enum: ["pending", "completed", "failed", "waiting_budget", "skipped"],
        length: 20,
      })
      .notNull(),
    lastError: t.varchar({ length: 255 }),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [
    index("core_files_alt_state_status_idx")
      .on(t.status)
      .where(sql`status <> 'completed'`),
  ],
);
