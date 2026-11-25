import { z } from "zod";

import {
  LEGAL_DELIVERY_SKIP_REASONS,
  LEGAL_DELIVERY_STATUSES,
} from "@/database/legal";
import {
  zodLegalAcceptanceLabel,
  zodLegalBody,
  zodLegalDocumentType,
  zodLegalStoredBody,
  zodLegalSummary,
  zodLegalTitle,
} from "@/lib/legal/contract";

export const zodAdminLegalPerson = z
  .object({ id: z.number(), name: z.string(), nameCode: z.string() })
  .nullable();

export const zodAdminLegalDeliveryStats = z.object({
  total: z.number().int(),
  pending: z.number().int(),
  sent: z.number().int(),
  failed: z.number().int(),
  skipped: z.object({
    no_address: z.number().int(),
    unverified: z.number().int(),
    deleted: z.number().int(),
  }),
});

export const zodAdminLegalFanout = z.object({
  status: z.enum(["pending", "running", "completed"]),
  completedAt: z.string().nullable(),
  /** Set while the email provider keeps failing. */
  incidentAt: z.string().nullable(),
  lastError: z.string().nullable(),
});

/** One announced version without its content. */
export const zodAdminLegalVersionSummary = z.object({
  id: z.number().int(),
  documentType: zodLegalDocumentType,
  version: z.number().int(),
  /** The title in the default language. */
  title: z.string(),
  requiresAcceptance: z.boolean(),
  announcedAt: z.string(),
  effectiveAt: z.string(),
  status: z.enum(["current", "past", "upcoming"]),
  publishedBy: zodAdminLegalPerson,
  deliveries: zodAdminLegalDeliveryStats,
  fanout: zodAdminLegalFanout.nullable(),
  /** Members who accepted exactly this version. */
  acceptances: z.number().int(),
});

export const zodAdminLegalVersion = zodAdminLegalVersionSummary.extend({
  title: zodLegalTitle,
  body: zodLegalStoredBody,
  summary: zodLegalSummary,
  acceptanceLabel: zodLegalAcceptanceLabel,
  defaultLanguageCode: z.string(),
  contentHash: z.string(),
  basedOnVersion: z.number().int().nullable(),
  previousVersion: z.number().int().nullable(),
});

export const zodAdminLegalDraft = z.object({
  documentType: zodLegalDocumentType,
  basedOnVersion: z.number().int().nullable(),
  title: zodLegalTitle,
  body: zodLegalStoredBody,
  summary: zodLegalSummary,
  acceptanceLabel: zodLegalAcceptanceLabel,
  requiresAcceptance: z.boolean(),
  effectiveAt: z.string().nullable(),
  revision: z.number().int(),
  updatedAt: z.string(),
  updatedBy: zodAdminLegalPerson,
});

/** What the draft editor needs besides the draft itself. */
export const zodAdminLegalDraftContext = z.object({
  draft: zodAdminLegalDraft.nullable(),
  /** i18n keys under `admin.system.legal.publish.problems`. */
  problems: z.array(z.string()),
  defaultLanguageCode: z.string(),
  emailConfigured: z.boolean(),
  /** The next version number the draft would get. */
  nextVersion: z.number().int(),
  /** `true` for the first Terms version, which always requires acceptance. */
  acceptanceForced: z.boolean(),
  current: zodAdminLegalVersionSummary.nullable(),
  upcoming: zodAdminLegalVersionSummary.nullable(),
  /** Every announced version, newest first, to start a draft from. */
  versions: z.array(
    z.object({ id: z.number().int(), version: z.number().int() }),
  ),
});

export const zodAdminLegalOverview = z.object({
  emailConfigured: z.boolean(),
  documents: z.array(
    z.object({
      documentType: zodLegalDocumentType,
      current: zodAdminLegalVersionSummary.nullable(),
      upcoming: zodAdminLegalVersionSummary.nullable(),
      draft: z
        .object({
          revision: z.number().int(),
          updatedAt: z.string(),
          basedOnVersion: z.number().int().nullable(),
        })
        .nullable(),
      versionsCount: z.number().int(),
    }),
  ),
});

export const zodAdminLegalDraftUpdate = z.object({
  /** The revision the editor loaded; a newer one answers `409`. */
  revision: z.number().int(),
  title: zodLegalTitle,
  body: zodLegalBody,
  summary: zodLegalSummary,
  acceptanceLabel: zodLegalAcceptanceLabel,
  requiresAcceptance: z.boolean(),
  effectiveAt: z.iso.datetime({ offset: true }).nullable(),
});

export const zodAdminLegalPublish = z.object({
  revision: z.number().int(),
  effectiveAt: z.iso.datetime({ offset: true }),
  requiresAcceptance: z.boolean(),
  /**
   * The operator confirmed the publication checklist: notice period and
   * wording match what their installation must give. Required.
   */
  checklistConfirmed: z.literal(true),
});

export const zodAdminLegalDelivery = z.object({
  id: z.number().int(),
  status: z.enum(LEGAL_DELIVERY_STATUSES),
  skipReason: z.enum(LEGAL_DELIVERY_SKIP_REASONS).nullable(),
  attempts: z.number().int(),
  lastError: z.string().nullable(),
  providerMessageId: z.string().nullable(),
  lastAttemptAt: z.string().nullable(),
  nextAttemptAt: z.string(),
  sentAt: z.string().nullable(),
  user: z.object({
    id: z.number(),
    name: z.string(),
    nameCode: z.string(),
    email: z.string(),
  }),
});

export const zodAdminLegalAcceptance = z.object({
  id: z.number().int(),
  acceptedAt: z.string(),
  locale: z.string(),
  source: z.enum(["signup", "gate"]),
  user: z.object({ id: z.number(), name: z.string(), nameCode: z.string() }),
});

export const zodDocumentTypeParam = z.object({
  documentType: zodLegalDocumentType,
});

export const zodVersionIdParam = z.object({
  id: z.coerce.number().int().positive(),
});

export const zodCursorQuery = z.object({
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
