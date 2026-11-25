import type { Context } from "hono";

import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import {
  core_legal_acceptances,
  core_legal_notice_dismissals,
  core_legal_versions,
} from "@/database/legal";
import { manifest } from "@/manifest";

import type { DomainCache } from "../cache";
import type { LegalDocumentType, LegalMemberState } from "./contract";
import type { LegalTimeline, LegalTimelineEntry } from "./timeline";

import { defineCacheEntry } from "../cache-entry";
import { invalidatePageCacheTags } from "../page-cache";
import { LEGAL_DOCUMENT_TYPES, legalPageCacheTag } from "./contract";
import { pendingTermsOf, resolveLegalTimeline } from "./timeline";

/** A database handle or a transaction. */
export type LegalDb = Omit<Context["var"]["db"], "$client">;

/**
 * Every announced version's dates and acceptance mode - never its content.
 * Safe to cache across requests because the timeline is resolved against the
 * clock on every read, so a scheduled version turns effective on time.
 */
const legalTimelineCache = defineCacheEntry({
  pluginId: manifest.id,
  name: "legal.timeline",
  version: 1,
  schema: z.array(
    z.object({
      announcedAt: z.string(),
      documentType: z.enum(LEGAL_DOCUMENT_TYPES),
      effectiveAt: z.string(),
      id: z.number().int(),
      requiresAcceptance: z.boolean(),
      version: z.number().int(),
    }),
  ),
  ttlSeconds: 300,
});

const perRequest = new WeakMap<Context, Promise<LegalTimelineEntry[]>>();

/** Reads every announced version's timeline entry from the database. */
export const readLegalTimelineEntries = async (
  db: LegalDb,
): Promise<LegalTimelineEntry[]> => {
  const rows = await db
    .select({
      announcedAt: core_legal_versions.announcedAt,
      documentType: core_legal_versions.documentType,
      effectiveAt: core_legal_versions.effectiveAt,
      id: core_legal_versions.id,
      requiresAcceptance: core_legal_versions.requiresAcceptance,
      version: core_legal_versions.version,
    })
    .from(core_legal_versions);

  return rows.map(row => ({
    ...row,
    announcedAt: row.announcedAt.toISOString(),
    effectiveAt: row.effectiveAt.toISOString(),
  }));
};

/**
 * Every announced version's timeline entry, read once per request and shared
 * through the cache for 300 s. Server-only.
 */
export const loadLegalTimelineEntries = async (
  c: Context,
): Promise<LegalTimelineEntry[]> => {
  const remembered = perRequest.get(c);
  if (remembered) return await remembered;

  const cache: DomainCache | undefined = c.get("cache");
  const db = c.get("db");
  const loading = cache
    ? cache
        .entry(legalTimelineCache)
        .remember(async () => await readLegalTimelineEntries(db))
    : readLegalTimelineEntries(db);
  perRequest.set(c, loading);

  return await loading;
};

/** Both document types' timelines at `now`. Server-only. */
export const loadLegalTimelines = async (
  c: Context,
  now: Date = new Date(),
): Promise<Record<LegalDocumentType, LegalTimeline>> => {
  const entries = await loadLegalTimelineEntries(c);

  return {
    privacy: resolveLegalTimeline(entries, "privacy", now),
    terms: resolveLegalTimeline(entries, "terms", now),
  };
};

/**
 * Whether Terms acceptance is enforced at all: only once a Terms version is
 * effective. Installs without legal publications behave as before.
 */
export const isTermsAcceptanceActive = (
  timelines: Record<LegalDocumentType, LegalTimeline>,
): boolean => timelines.terms.required !== null;

/** The Terms version ids a member has accepted. */
export const acceptedTermsVersionIdsOf = async (
  db: LegalDb,
  userId: number,
): Promise<number[]> => {
  const rows = await db
    .select({ versionId: core_legal_acceptances.versionId })
    .from(core_legal_acceptances)
    .where(eq(core_legal_acceptances.userId, userId));

  return rows.map(row => row.versionId);
};

/** The highest Terms version number among `acceptedIds`, or `null`. */
export const lastAcceptedTermsVersion = (
  timeline: LegalTimeline,
  acceptedIds: readonly number[],
): null | number => {
  const accepted = new Set(acceptedIds);
  const versions = timeline.history
    .filter(entry => accepted.has(entry.id))
    .map(entry => entry.version);

  return versions.length > 0 ? Math.max(...versions) : null;
};

const pendingPerRequest = new WeakMap<
  Context,
  Promise<LegalTimelineEntry | null>
>();

/**
 * The Terms version the signed-in member must accept before using community
 * features, or `null` when they are clear, signed out, or no Terms version is
 * effective yet. Read once per request. Server-only.
 */
export const pendingTermsForRequest = async (
  c: Context,
): Promise<LegalTimelineEntry | null> => {
  const remembered = pendingPerRequest.get(c);
  if (remembered) return await remembered;

  const loading = (async () => {
    const user = c.get("user");
    if (!user) return null;
    const { terms } = await loadLegalTimelines(c);
    if (!terms.required) return null;

    const accepted = await acceptedTermsVersionIdsOf(c.get("db"), user.id);

    return pendingTermsOf(terms, lastAcceptedTermsVersion(terms, accepted));
  })();
  pendingPerRequest.set(c, loading);

  return await loading;
};

/**
 * The signed-in member's legal state: the Terms version they owe, if any,
 * and the informational notices they have not dismissed. A notice is shown
 * for the newest announced version of each type (upcoming included) that
 * replaced an earlier one and was announced after the member joined. Terms
 * notices step aside while acceptance is pending - the gate covers it.
 * Server-only.
 */
export const loadMemberLegalState = async (
  c: Context,
  user: { createdAt: Date; id: number },
  now: Date = new Date(),
): Promise<LegalMemberState> => {
  const timelines = await loadLegalTimelines(c, now);
  const db = c.get("db");
  const accepted = await acceptedTermsVersionIdsOf(db, user.id);
  const lastAccepted = lastAcceptedTermsVersion(timelines.terms, accepted);
  const pending = pendingTermsOf(timelines.terms, lastAccepted);

  const candidates = LEGAL_DOCUMENT_TYPES.flatMap(documentType => {
    const timeline = timelines[documentType];
    const latest = timeline.upcoming ?? timeline.current;
    if (!latest || latest.version === 1) return [];
    if (Date.parse(latest.announcedAt) <= user.createdAt.getTime()) return [];
    if (documentType === "terms" && (pending || accepted.includes(latest.id))) {
      return [];
    }

    return [{ entry: latest, timeline }];
  });

  const dismissed = new Set(
    candidates.length === 0
      ? []
      : (
          await db
            .select({ versionId: core_legal_notice_dismissals.versionId })
            .from(core_legal_notice_dismissals)
            .where(
              and(
                eq(core_legal_notice_dismissals.userId, user.id),
                inArray(
                  core_legal_notice_dismissals.versionId,
                  candidates.map(item => item.entry.id),
                ),
              ),
            )
        ).map(row => row.versionId),
  );

  const upcoming = LEGAL_DOCUMENT_TYPES.map(
    type => timelines[type].upcoming?.effectiveAt,
  )
    .filter((value): value is string => value !== undefined)
    .sort();

  return {
    nextChangeAt: upcoming[0] ?? null,
    notices: candidates
      .filter(({ entry }) => !dismissed.has(entry.id))
      .map(({ entry, timeline }) => ({
        documentType: entry.documentType,
        effectiveAt: entry.effectiveAt,
        previousVersion:
          timeline.history.find(item => item.version < entry.version)
            ?.version ?? null,
        requiresAcceptance: entry.requiresAcceptance,
        upcoming: Date.parse(entry.effectiveAt) > now.getTime(),
        version: entry.version,
        versionId: entry.id,
      })),
    pendingTerms: pending
      ? {
          lastAcceptedVersion: lastAccepted,
          version: pending.version,
          versionId: pending.id,
        }
      : null,
  };
};

/**
 * Serialises legal writes of one document type inside a transaction:
 * announcing takes it exclusively, acceptance and sign-up take it shared, so a
 * version check and its write never interleave with a publication.
 */
export const lockLegalDocument = async (
  tx: LegalDb,
  documentType: LegalDocumentType,
  mode: "exclusive" | "shared",
): Promise<void> => {
  const key = `vitnode:legal:${documentType}`;
  await tx.execute(
    mode === "exclusive"
      ? sql`select pg_advisory_xact_lock(hashtext(${key}))`
      : sql`select pg_advisory_xact_lock_shared(hashtext(${key}))`,
  );
};

/**
 * Expires every cached copy of the legal timeline and the public document
 * pages of `documentTypes`. Call it after a publication commits and when a
 * scheduled version takes effect. Server-only.
 */
export const invalidateLegalCaches = async (
  c: Context,
  documentTypes: readonly LegalDocumentType[] = LEGAL_DOCUMENT_TYPES,
): Promise<void> => {
  perRequest.delete(c);
  pendingPerRequest.delete(c);
  const cache: DomainCache | undefined = c.get("cache");
  await cache?.entry(legalTimelineCache).delete();
  await invalidatePageCacheTags(documentTypes.map(legalPageCacheTag), {
    mode: "hard",
  });
};
