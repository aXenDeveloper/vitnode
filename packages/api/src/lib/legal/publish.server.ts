import type { Context } from "hono";

import { eq, max } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { isRichTextEmpty } from "@/content/rich-text/document";
import {
  core_legal_drafts,
  core_legal_fanouts,
  core_legal_versions,
} from "@/database/legal";
import {
  legalVersionAnnouncedEvent,
  legalVersionEffectiveEvent,
} from "@/events/legal";
import { legalChangesChannel } from "@/ws/legal";

import type { EnvVitNode } from "../../middlewares/global.middleware";
import type { LegalDocumentType } from "./contract";

import { writeAuditLog } from "../audit/write";
import { throwLegalError } from "./acceptance.server";
import { LEGAL_ERROR_CODES } from "./contract";
import { legalEffectiveTask, legalFanoutTask } from "./delivery-tasks";
import {
  invalidateLegalCaches,
  lockLegalDocument,
  readLegalTimelineEntries,
} from "./state.server";
import { resolveLegalTimeline } from "./timeline";

/** A past effective time within this window is treated as "now". */
const PAST_TOLERANCE_MS = 5 * 60 * 1000;

type DraftRow = typeof core_legal_drafts.$inferSelect;

/**
 * Problems that keep a draft from being announced, as i18n keys under
 * `admin.system.legal.publish.problems`. Empty when it can be announced. Pure.
 */
export const legalDraftProblems = (
  draft: Pick<DraftRow, "body" | "documentType" | "summary" | "title">,
  {
    defaultLanguageCode,
    hasPreviousVersion,
  }: { defaultLanguageCode: string; hasPreviousVersion: boolean },
): string[] => {
  const problems: string[] = [];
  const title = draft.title.find(
    item => item.languageCode === defaultLanguageCode,
  );
  const body = draft.body.find(
    item => item.languageCode === defaultLanguageCode,
  );
  const summary = draft.summary.find(
    item => item.languageCode === defaultLanguageCode,
  );
  if (!title?.value.trim()) problems.push("title_missing");
  if (!body || isRichTextEmpty(body.value)) problems.push("body_missing");
  if (hasPreviousVersion && !summary?.value.trim()) {
    problems.push("summary_missing");
  }

  return problems;
};

/** SHA-256 of the frozen content, hex. Universal (Web Crypto). */
export const legalContentHash = async (content: unknown): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(content)),
  );

  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
};

export interface AnnounceLegalDraftArgs {
  actorId: number;
  documentType: LegalDocumentType;
  /** When the version takes effect; a time in the past means now. */
  effectiveAt: Date;
  /** Only Terms can require it; the first Terms version always does. */
  requiresAcceptance: boolean;
  /** The draft revision the operator reviewed. */
  revision: number;
}

/**
 * Announces a draft as the next immutable version. In one transaction, under
 * the document's exclusive legal lock: validates it, inserts the version,
 * writes its fan-out record, queues the fan-out (and, for a future date, the
 * effective-time refresh), records the audit entry and deletes the draft.
 * If any write fails, nothing is announced. Afterwards it expires caches and
 * emits `legal.version.announced`. Server-only.
 *
 * @throws `409 LEGAL_EMAIL_ADAPTER_MISSING` without an email adapter,
 * `409 LEGAL_UPCOMING_VERSION_EXISTS` while another version is scheduled,
 * `409 LEGAL_DRAFT_CONFLICT` when the draft changed, `404` without a draft,
 * `400` for invalid content or dates.
 */
export const announceLegalDraft = async (
  c: Context<EnvVitNode>,
  args: AnnounceLegalDraftArgs,
): Promise<typeof core_legal_versions.$inferSelect> => {
  if (!c.get("core").email?.adapter) {
    return throwLegalError(409, LEGAL_ERROR_CODES.emailAdapterMissing);
  }

  const now = new Date();
  if (args.effectiveAt.getTime() < now.getTime() - PAST_TOLERANCE_MS) {
    throw new HTTPException(400, {
      message: "The effective date must not be in the past.",
    });
  }
  const effectiveAt =
    args.effectiveAt.getTime() < now.getTime() ? now : args.effectiveAt;
  const defaultLanguageCode = c.get("core").i18n.defaultLocale;

  const version = await c.get("db").transaction(async tx => {
    await lockLegalDocument(tx, args.documentType, "exclusive");

    const [draft] = await tx
      .select()
      .from(core_legal_drafts)
      .where(eq(core_legal_drafts.documentType, args.documentType))
      .for("update")
      .limit(1);
    if (!draft)
      throw new HTTPException(404, { message: "No draft to announce." });
    if (draft.revision !== args.revision) {
      return throwLegalError(409, LEGAL_ERROR_CODES.draftConflict, {
        revision: draft.revision,
      });
    }

    const timeline = resolveLegalTimeline(
      await readLegalTimelineEntries(tx),
      args.documentType,
      now,
    );
    if (timeline.upcoming) {
      return throwLegalError(409, LEGAL_ERROR_CODES.upcomingExists, {
        upcoming: {
          effectiveAt: timeline.upcoming.effectiveAt,
          version: timeline.upcoming.version,
        },
      });
    }

    const problems = legalDraftProblems(draft, {
      defaultLanguageCode,
      hasPreviousVersion: timeline.history.length > 0,
    });
    if (problems.length > 0) {
      throw new HTTPException(400, {
        message: `The draft is incomplete: ${problems.join(", ")}.`,
      });
    }

    const [latest] = await tx
      .select({ version: max(core_legal_versions.version) })
      .from(core_legal_versions)
      .where(eq(core_legal_versions.documentType, args.documentType));
    const nextVersion = (latest?.version ?? 0) + 1;
    const isFirstTerms =
      args.documentType === "terms" && timeline.history.length === 0;
    const requiresAcceptance =
      args.documentType === "terms" &&
      (isFirstTerms || args.requiresAcceptance);

    const content = {
      acceptanceLabel: draft.acceptanceLabel,
      body: draft.body,
      defaultLanguageCode,
      documentType: args.documentType,
      effectiveAt: effectiveAt.toISOString(),
      requiresAcceptance,
      summary: draft.summary,
      title: draft.title,
      version: nextVersion,
    };

    const [inserted] = await tx
      .insert(core_legal_versions)
      .values({
        acceptanceLabel: draft.acceptanceLabel,
        announcedAt: now,
        basedOnVersionId: draft.basedOnVersionId,
        body: draft.body,
        contentHash: await legalContentHash(content),
        defaultLanguageCode,
        documentType: args.documentType,
        effectiveAt,
        publishedById: args.actorId,
        requiresAcceptance,
        summary: draft.summary,
        title: draft.title,
        version: nextVersion,
      })
      .returning();
    if (!inserted) throw new Error("The legal version was not stored.");

    await tx.insert(core_legal_fanouts).values({
      recipientsCreatedBefore: now,
      versionId: inserted.id,
    });
    await c
      .get("queue")
      .dispatch(
        legalFanoutTask,
        { versionId: inserted.id },
        { priority: 5, tx },
      );
    if (effectiveAt.getTime() > now.getTime()) {
      await c
        .get("queue")
        .dispatch(
          legalEffectiveTask,
          { versionId: inserted.id },
          { availableAt: effectiveAt, tx },
        );
    }

    await writeAuditLog(
      c,
      {
        action: "legal.version_announced",
        metadata: {
          effectiveAt: effectiveAt.toISOString(),
          requiresAcceptance,
          version: nextVersion,
        },
        target: {
          id: inserted.id,
          label: `${args.documentType} v${nextVersion}`,
          type: "legal_document",
        },
      },
      tx,
    );

    await tx
      .delete(core_legal_drafts)
      .where(eq(core_legal_drafts.documentType, args.documentType));

    return inserted;
  });

  await invalidateLegalCaches(c, [args.documentType]);
  await c.get("events").emit(legalVersionAnnouncedEvent, {
    documentType: version.documentType,
    effectiveAt: version.effectiveAt.toISOString(),
    publishedById: args.actorId,
    requiresAcceptance: version.requiresAcceptance,
    version: version.version,
    versionId: version.id,
  });
  if (version.effectiveAt.getTime() <= Date.now()) {
    c.get("realtime").broadcast(legalChangesChannel, { versionId: version.id });
    await c.get("events").emit(legalVersionEffectiveEvent, {
      documentType: version.documentType,
      requiresAcceptance: version.requiresAcceptance,
      version: version.version,
      versionId: version.id,
    });
  }

  return version;
};
