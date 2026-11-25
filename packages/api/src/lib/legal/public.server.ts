import type { Context } from "hono";

import { and, desc, eq } from "drizzle-orm";

import { core_legal_versions } from "@/database/legal";

import type {
  LegalComparison,
  LegalDocumentOverview,
  LegalDocumentType,
  LegalVersionDocument,
  LegalVersionMeta,
} from "./contract";
import type { LegalTimeline, LegalTimelineEntry } from "./timeline";

import {
  legalAvailableLocales,
  localizeLegalContent,
  pickLegalCompareLocale,
} from "./contract";
import { diffLegalDocuments } from "./diff";
import { loadLegalTimelines } from "./state.server";
import { legalVersionStatus } from "./timeline";

type VersionRow = typeof core_legal_versions.$inferSelect;
type HistoryRow = Omit<VersionRow, "body"> & {
  body?: VersionRow["body"];
};

/**
 * The locale a request asks for: `?locale=`, else the site's default. An
 * unknown code is kept as asked - the version's own fallback decides.
 */
export const legalRequestLocale = (c: Context, locale?: string): string =>
  locale ?? c.get("core").i18n.defaultLocale;

const metaOf = (
  row: HistoryRow,
  timeline: LegalTimeline,
  locale: string,
  now: Date,
): LegalVersionMeta => {
  const content = {
    acceptanceLabel: row.acceptanceLabel,
    body: row.body ?? [],
    summary: row.summary,
    title: row.title,
  };
  // History rows skip the bodies; titles alone decide their language then.
  const snapshot = localizeLegalContent(
    row.body ? content : { ...content, body: titlesAsBodies(row) },
    locale,
    row.defaultLanguageCode,
  );
  const entry: LegalTimelineEntry = {
    announcedAt: row.announcedAt.toISOString(),
    documentType: row.documentType,
    effectiveAt: row.effectiveAt.toISOString(),
    id: row.id,
    requiresAcceptance: row.requiresAcceptance,
    version: row.version,
  };

  return {
    announcedAt: entry.announcedAt,
    availableLocales: row.body
      ? legalAvailableLocales(content)
      : legalAvailableLocales({ body: titlesAsBodies(row), title: row.title }),
    documentType: row.documentType,
    effectiveAt: entry.effectiveAt,
    id: row.id,
    locale: snapshot.locale,
    requiresAcceptance: row.requiresAcceptance,
    status: legalVersionStatus(entry, timeline, now),
    summary: snapshot.summary,
    title: snapshot.title,
    version: row.version,
  };
};

/** Stand-in bodies for rows read without them, so every titled language counts. */
const titlesAsBodies = (row: Pick<VersionRow, "title">) =>
  row.title.map(item => ({
    languageCode: item.languageCode,
    value: {
      content: [{ content: [{ text: "-", type: "text" }], type: "paragraph" }],
      type: "doc" as const,
    },
  }));

const documentOf = (
  row: VersionRow,
  timeline: LegalTimeline,
  locale: string,
  now: Date,
): LegalVersionDocument => {
  const snapshot = localizeLegalContent(row, locale, row.defaultLanguageCode);

  return {
    ...metaOf(row, timeline, locale, now),
    acceptanceLabel: snapshot.acceptanceLabel,
    body: snapshot.body,
    contentHash: row.contentHash,
    previousVersion:
      timeline.history.find(entry => entry.version < row.version)?.version ??
      null,
  };
};

const historyColumns = {
  acceptanceLabel: core_legal_versions.acceptanceLabel,
  announcedAt: core_legal_versions.announcedAt,
  basedOnVersionId: core_legal_versions.basedOnVersionId,
  contentHash: core_legal_versions.contentHash,
  defaultLanguageCode: core_legal_versions.defaultLanguageCode,
  documentType: core_legal_versions.documentType,
  effectiveAt: core_legal_versions.effectiveAt,
  id: core_legal_versions.id,
  publishedById: core_legal_versions.publishedById,
  requiresAcceptance: core_legal_versions.requiresAcceptance,
  summary: core_legal_versions.summary,
  title: core_legal_versions.title,
  version: core_legal_versions.version,
};

/** Reads one announced version by its number. */
export const findLegalVersionRow = async (
  c: Context,
  documentType: LegalDocumentType,
  version: number,
): Promise<null | VersionRow> => {
  const [row] = await c
    .get("db")
    .select()
    .from(core_legal_versions)
    .where(
      and(
        eq(core_legal_versions.documentType, documentType),
        eq(core_legal_versions.version, version),
      ),
    )
    .limit(1);

  return row ?? null;
};

/**
 * The public overview of a document type in `locale`: the effective version
 * in full, the upcoming one and the whole announced history. Server-only.
 */
export const loadLegalOverview = async (
  c: Context,
  documentType: LegalDocumentType,
  locale: string,
): Promise<LegalDocumentOverview> => {
  const now = new Date();
  const timeline = (await loadLegalTimelines(c, now))[documentType];
  const rows = await c
    .get("db")
    .select(historyColumns)
    .from(core_legal_versions)
    .where(eq(core_legal_versions.documentType, documentType))
    .orderBy(desc(core_legal_versions.version));
  const history = rows.map(row => metaOf(row, timeline, locale, now));
  const currentRow = timeline.current
    ? await findLegalVersionRow(c, documentType, timeline.current.version)
    : null;

  return {
    current: currentRow ? documentOf(currentRow, timeline, locale, now) : null,
    documentType,
    history,
    upcoming: history.find(item => item.status === "upcoming") ?? null,
  };
};

/** One announced version in `locale`, or `null`. Server-only. */
export const loadLegalVersionDocument = async (
  c: Context,
  documentType: LegalDocumentType,
  version: number,
  locale: string,
): Promise<LegalVersionDocument | null> => {
  const now = new Date();
  const row = await findLegalVersionRow(c, documentType, version);
  if (!row) return null;
  const timeline = (await loadLegalTimelines(c, now))[documentType];

  return documentOf(row, timeline, locale, now);
};

/**
 * Compares version `to` with `from` (default: its predecessor) block by
 * block, both shown in one shared language when they have one. `from` may be
 * `null` for a first version: the whole text is then an addition. Returns
 * `null` when `to` (or an explicit `from`) does not exist. Server-only.
 */
export const loadLegalComparison = async (
  c: Context,
  documentType: LegalDocumentType,
  to: number,
  locale: string,
  from?: number,
): Promise<LegalComparison | null> => {
  const now = new Date();
  const timeline = (await loadLegalTimelines(c, now))[documentType];
  const toRow = await findLegalVersionRow(c, documentType, to);
  if (!toRow) return null;

  const fromNumber =
    from ?? timeline.history.find(entry => entry.version < to)?.version;
  const fromRow =
    fromNumber === undefined
      ? null
      : await findLegalVersionRow(c, documentType, fromNumber);
  if (from !== undefined && !fromRow) return null;

  const shared = fromRow
    ? pickLegalCompareLocale(fromRow, toRow, locale, toRow.defaultLanguageCode)
    : null;
  const toSnapshot = localizeLegalContent(
    toRow,
    shared ?? locale,
    toRow.defaultLanguageCode,
  );
  const fromSnapshot = fromRow
    ? localizeLegalContent(
        fromRow,
        shared ?? locale,
        fromRow.defaultLanguageCode,
      )
    : null;
  const { blocks, stats } = diffLegalDocuments(
    fromSnapshot?.body ?? null,
    toSnapshot.body,
  );

  return {
    blocks,
    documentType,
    from: fromRow ? metaOf(fromRow, timeline, shared ?? locale, now) : null,
    locale: fromRow ? shared : toSnapshot.locale,
    stats,
    summary: toSnapshot.summary,
    to: metaOf(toRow, timeline, shared ?? locale, now),
  };
};
