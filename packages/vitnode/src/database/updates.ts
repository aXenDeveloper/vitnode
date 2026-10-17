import { camelCase } from "drizzle-orm/pg-core";

import type { UpdateEvaluation } from "@/api/lib/updates/evaluate";
import type { UpdateManifest } from "@/lib/updates/manifest";

export interface UpdateCheckError {
  code: string;
  detail: null | string;
}

/**
 * One row per update manifest URL in use. `document` is the last copy that
 * passed validation, cut down to the packages this install checks - kept on a
 * failed fetch so findings and security warnings survive it, and answering a
 * `304 Not Modified`.
 */
export const core_update_sources = camelCase.table.withRLS(
  "core_update_sources",
  t => ({
    url: t.varchar({ length: 2048 }).primaryKey(),
    etag: t.varchar({ length: 512 }),
    lastModified: t.varchar({ length: 128 }),
    document: t.jsonb().$type<UpdateManifest>(),
    lastAttemptAt: t.timestamp().notNull(),
    lastSuccessAt: t.timestamp(),
    lastError: t.jsonb().$type<UpdateCheckError>(),
  }),
);

/**
 * One row per checked component (core or a plugin): the latest result only,
 * never a history. `sourceUrl`, `channel`, `versions` and `coreVersion` are
 * what the result was computed for, so a redeploy or a config change shows up
 * as a stale result instead of passing for a fresh check.
 */
export const core_update_results = camelCase.table.withRLS(
  "core_update_results",
  t => ({
    componentId: t.varchar({ length: 214 }).primaryKey(),
    sourceUrl: t.varchar({ length: 2048 }).notNull(),
    channel: t.varchar({ length: 20 }),
    versions: t.jsonb().$type<string[]>().notNull(),
    hasUnknownVersion: t.boolean().notNull().default(false),
    coreVersion: t.varchar({ length: 256 }),
    result: t.jsonb().$type<UpdateEvaluation>(),
    lastAttemptAt: t.timestamp().notNull(),
    lastSuccessAt: t.timestamp(),
    lastError: t.jsonb().$type<UpdateCheckError>(),
  }),
);

/**
 * The lease every instance takes before checking, so a daily run and a manual
 * one - or two API instances - never fetch at the same time. `expiresAt` bounds
 * how long an instance that died mid-check keeps it.
 */
export const core_update_lock = camelCase.table.withRLS(
  "core_update_lock",
  t => ({
    name: t.varchar({ length: 50 }).primaryKey(),
    owner: t.varchar({ length: 64 }),
    expiresAt: t.timestamp(),
    lastManualAt: t.timestamp(),
  }),
);
