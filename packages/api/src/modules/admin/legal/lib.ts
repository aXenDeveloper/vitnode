import type { Context } from "hono";
import type { z } from "zod";

import { count, desc, eq, inArray } from "drizzle-orm";

import {
  core_legal_acceptances,
  core_legal_drafts,
  core_legal_fanouts,
  core_legal_versions,
} from "@/database/legal";
import { core_users } from "@/database/users";
import {
  type LegalDocumentType,
  localizeLegalContent,
} from "@/lib/legal/contract";
import { legalDeliveryStats } from "@/lib/legal/delivery.server";
import { readLegalTimelineEntries } from "@/lib/legal/state.server";
import { legalVersionStatus, resolveLegalTimeline } from "@/lib/legal/timeline";

import type {
  zodAdminLegalDraft,
  zodAdminLegalVersion,
  zodAdminLegalVersionSummary,
} from "./legal.schema";

type VersionRow = typeof core_legal_versions.$inferSelect;

const iso = (value: Date | null): null | string => value?.toISOString() ?? null;

/**
 * AdminCP summaries of announced versions: status, publisher, delivery
 * counts, fan-out state and acceptance count. Server-only.
 */
export const adminLegalVersionSummaries = async (
  c: Context,
  rows: VersionRow[],
): Promise<z.output<typeof zodAdminLegalVersionSummary>[]> => {
  if (rows.length === 0) return [];
  const db = c.get("db");
  const ids = rows.map(row => row.id);
  const entries = await readLegalTimelineEntries(db);
  const now = new Date();

  const [publishers, fanouts, acceptances, deliveries] = await Promise.all([
    db
      .select({
        id: core_users.id,
        name: core_users.name,
        nameCode: core_users.nameCode,
      })
      .from(core_users)
      .where(
        inArray(
          core_users.id,
          rows.flatMap(row => (row.publishedById ? [row.publishedById] : [])),
        ),
      ),
    db
      .select()
      .from(core_legal_fanouts)
      .where(inArray(core_legal_fanouts.versionId, ids)),
    db
      .select({
        count: count(),
        versionId: core_legal_acceptances.versionId,
      })
      .from(core_legal_acceptances)
      .where(inArray(core_legal_acceptances.versionId, ids))
      .groupBy(core_legal_acceptances.versionId),
    legalDeliveryStats(c, ids),
  ]);

  return rows.map(row => {
    const timeline = resolveLegalTimeline(entries, row.documentType, now);
    const entry = entries.find(item => item.id === row.id);
    const fanout = fanouts.find(item => item.versionId === row.id);
    const publisher = publishers.find(item => item.id === row.publishedById);

    return {
      acceptances:
        acceptances.find(item => item.versionId === row.id)?.count ?? 0,
      announcedAt: row.announcedAt.toISOString(),
      deliveries: deliveries.get(row.id) ?? {
        failed: 0,
        pending: 0,
        sent: 0,
        skipped: { deleted: 0, no_address: 0, unverified: 0 },
        total: 0,
      },
      documentType: row.documentType,
      effectiveAt: row.effectiveAt.toISOString(),
      fanout: fanout
        ? {
            completedAt: iso(fanout.completedAt),
            incidentAt: iso(fanout.incidentAt),
            lastError: fanout.lastError,
            status: fanout.status,
          }
        : null,
      id: row.id,
      publishedBy: publisher ?? null,
      requiresAcceptance: row.requiresAcceptance,
      status: entry ? legalVersionStatus(entry, timeline, now) : "past",
      title: localizeLegalContent(
        row,
        row.defaultLanguageCode,
        row.defaultLanguageCode,
      ).title,
      version: row.version,
    };
  });
};

/** Every announced version of a document type, newest first. */
export const adminLegalVersionsOf = async (
  c: Context,
  documentType: LegalDocumentType,
): Promise<VersionRow[]> =>
  await c
    .get("db")
    .select()
    .from(core_legal_versions)
    .where(eq(core_legal_versions.documentType, documentType))
    .orderBy(desc(core_legal_versions.version));

/** One version with its content, for the AdminCP. `null` when missing. */
export const adminLegalVersion = async (
  c: Context,
  id: number,
): Promise<null | z.output<typeof zodAdminLegalVersion>> => {
  const db = c.get("db");
  const [row] = await db
    .select()
    .from(core_legal_versions)
    .where(eq(core_legal_versions.id, id))
    .limit(1);
  if (!row) return null;

  const [summary] = await adminLegalVersionSummaries(c, [row]);
  if (!summary) return null;
  const siblings = await adminLegalVersionsOf(c, row.documentType);
  const basedOn = siblings.find(item => item.id === row.basedOnVersionId);

  return {
    ...summary,
    acceptanceLabel: row.acceptanceLabel,
    basedOnVersion: basedOn?.version ?? null,
    body: row.body,
    contentHash: row.contentHash,
    defaultLanguageCode: row.defaultLanguageCode,
    previousVersion:
      siblings.find(item => item.version < row.version)?.version ?? null,
    summary: row.summary,
    title: row.title,
  };
};

type DraftRow = typeof core_legal_drafts.$inferSelect;

/** The draft of a document type as the AdminCP edits it. */
export const adminLegalDraftOf = async (
  c: Context,
  documentType: LegalDocumentType,
  versions: VersionRow[],
): Promise<null | z.output<typeof zodAdminLegalDraft>> => {
  const db = c.get("db");
  const [draft] = await db
    .select()
    .from(core_legal_drafts)
    .where(eq(core_legal_drafts.documentType, documentType))
    .limit(1);
  if (!draft) return null;

  return await serializeAdminLegalDraft(c, draft, versions);
};

/** Serialises a stored draft for the AdminCP. */
export const serializeAdminLegalDraft = async (
  c: Context,
  draft: DraftRow,
  versions: VersionRow[],
): Promise<z.output<typeof zodAdminLegalDraft>> => {
  const [updatedBy] = draft.updatedById
    ? await c
        .get("db")
        .select({
          id: core_users.id,
          name: core_users.name,
          nameCode: core_users.nameCode,
        })
        .from(core_users)
        .where(eq(core_users.id, draft.updatedById))
        .limit(1)
    : [];

  return {
    acceptanceLabel: draft.acceptanceLabel,
    basedOnVersion:
      versions.find(item => item.id === draft.basedOnVersionId)?.version ??
      null,
    body: draft.body,
    documentType: draft.documentType,
    effectiveAt: iso(draft.effectiveAt),
    requiresAcceptance: draft.requiresAcceptance,
    revision: draft.revision,
    summary: draft.summary,
    title: draft.title,
    updatedAt: draft.updatedAt.toISOString(),
    updatedBy: updatedBy ?? null,
  };
};
