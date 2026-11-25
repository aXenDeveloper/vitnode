import { z } from "zod";

import type { RichTextDocument } from "@/content/rich-text/document";
import type { MultiLangValue } from "@/lib/helpers/multi-lang";

import {
  createRichTextDocumentSchema,
  isRichTextEmpty,
  zodRichTextDocument,
} from "@/content/rich-text/document";

/**
 * The legal document types core versions and publishes. Each has its own
 * version sequence, public page (`/terms`, `/privacy`) and draft. Browser-safe.
 */
export const LEGAL_DOCUMENT_TYPES = ["terms", "privacy"] as const;

export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[number];

export const zodLegalDocumentType = z.enum(LEGAL_DOCUMENT_TYPES);

/** Size limits of one legal document version. */
export const LEGAL_LIMITS = {
  /** Largest serialised body per language, in bytes. */
  bodyMaxBytes: 512 * 1024,
  titleMaxLength: 150,
  summaryMaxLength: 4000,
  acceptanceLabelMaxLength: 300,
} as const;

/**
 * Typed error codes the legal API answers with, in `{ error, code }`. The web
 * reacts to `TERMS_ACCEPTANCE_REQUIRED` by opening the acceptance page, and to
 * `TERMS_VERSION_CHANGED` by reloading the screen for a fresh decision.
 */
export const LEGAL_ERROR_CODES = {
  /** `403`: the signed-in member owes Terms acceptance. */
  acceptanceRequired: "TERMS_ACCEPTANCE_REQUIRED",
  /** `409`: the version the member saw is no longer the one to accept. */
  versionChanged: "TERMS_VERSION_CHANGED",
  /** `400`: password sign-up without accepting the effective Terms. */
  acceptanceMissing: "TERMS_ACCEPTANCE_MISSING",
  /** `409`: a document type already has an announced, not yet effective version. */
  upcomingExists: "LEGAL_UPCOMING_VERSION_EXISTS",
  /** `409`: publishing needs a configured transactional email adapter. */
  emailAdapterMissing: "LEGAL_EMAIL_ADAPTER_MISSING",
  /** `409`: the draft changed since it was loaded. */
  draftConflict: "LEGAL_DRAFT_CONFLICT",
} as const;

export type LegalErrorCode =
  (typeof LEGAL_ERROR_CODES)[keyof typeof LEGAL_ERROR_CODES];

/** The body of a `403 TERMS_ACCEPTANCE_REQUIRED` answer. Browser-safe. */
export const zodTermsAcceptanceRequiredError = z.object({
  error: z.literal("terms_acceptance_required"),
  code: z.literal(LEGAL_ERROR_CODES.acceptanceRequired),
  /** The Terms version (number) the member must accept. */
  version: z.number().int(),
  versionId: z.number().int(),
});

export type TermsAcceptanceRequiredError = z.output<
  typeof zodTermsAcceptanceRequiredError
>;

/** Whether a parsed error body is {@link TermsAcceptanceRequiredError}. Browser-safe. */
export const isTermsAcceptanceRequiredError = (
  value: unknown,
): value is TermsAcceptanceRequiredError =>
  typeof value === "object" &&
  value !== null &&
  "code" in value &&
  value.code === LEGAL_ERROR_CODES.acceptanceRequired;

const zodLanguageCode = z.string().min(1).max(32);

export const zodLegalTitle = z.array(
  z.object({
    languageCode: zodLanguageCode,
    value: z.string().trim().max(LEGAL_LIMITS.titleMaxLength),
  }),
);

export const zodLegalSummary = z.array(
  z.object({
    languageCode: zodLanguageCode,
    value: z.string().trim().max(LEGAL_LIMITS.summaryMaxLength),
  }),
);

export const zodLegalAcceptanceLabel = z.array(
  z.object({
    languageCode: zodLanguageCode,
    value: z.string().trim().max(LEGAL_LIMITS.acceptanceLabelMaxLength),
  }),
);

export const zodLegalBody = z.array(
  z.object({
    languageCode: zodLanguageCode,
    value: createRichTextDocumentSchema({
      maxBytes: LEGAL_LIMITS.bodyMaxBytes,
    }),
  }),
);

/** Stored body, as served (no size check on read). */
export const zodLegalStoredBody = z.array(
  z.object({ languageCode: z.string(), value: zodRichTextDocument }),
);

/** The localized content of a draft or version, one value per language. */
export interface LegalLocalizedContent {
  /** The checkbox label for Terms that require acceptance. */
  acceptanceLabel: MultiLangValue;
  body: MultiLangValue<RichTextDocument>;
  /** Plain-language summary of what changed, shown in history, notices and email. */
  summary: MultiLangValue;
  title: MultiLangValue;
}

/** One language's content, after locale fallback. */
export interface LegalLocalizedSnapshot {
  acceptanceLabel: string;
  body: RichTextDocument;
  /** The language actually used. Differs from the request when it fell back. */
  locale: string;
  summary: string;
  title: string;
}

const hasBody = (
  values: MultiLangValue<RichTextDocument>,
  code: string,
): boolean =>
  values.some(
    item => item.languageCode === code && !isRichTextEmpty(item.value),
  );

/**
 * The languages a version can be read in: those with a title and a body.
 * Sorted by code so every caller sees the same order. Browser-safe.
 */
export const legalAvailableLocales = (
  content: Pick<LegalLocalizedContent, "body" | "title">,
): string[] =>
  [
    ...new Set(
      content.title
        .filter(item => item.value.trim() !== "")
        .map(item => item.languageCode),
    ),
  ]
    .filter(code => hasBody(content.body, code))
    .sort();

/**
 * Picks the language to show a version in, deterministically: the requested
 * locale when the version has it, else the version's own default language
 * (the site's default when it was published), else the first available code
 * in alphabetical order. Browser-safe.
 */
export const pickLegalLocale = (
  content: Pick<LegalLocalizedContent, "body" | "title">,
  requested: string,
  defaultLanguageCode: string,
): string => {
  const available = legalAvailableLocales(content);
  if (available.includes(requested)) return requested;
  if (available.includes(defaultLanguageCode)) return defaultLanguageCode;

  return available[0] ?? defaultLanguageCode;
};

const valueIn = <T>(
  values: MultiLangValue<T>,
  locale: string,
  fallbackLocale: string,
): T | undefined =>
  (
    values.find(item => item.languageCode === locale) ??
    values.find(item => item.languageCode === fallbackLocale)
  )?.value;

/**
 * One language's snapshot of a version, using {@link pickLegalLocale}. The
 * summary and acceptance label follow the same language, falling back to the
 * default language on their own when that one is empty. Browser-safe.
 */
export const localizeLegalContent = (
  content: LegalLocalizedContent,
  requested: string,
  defaultLanguageCode: string,
): LegalLocalizedSnapshot => {
  const locale = pickLegalLocale(content, requested, defaultLanguageCode);
  const text = (values: MultiLangValue): string => {
    const own = valueIn(values, locale, locale)?.trim();
    if (own) return own;

    return valueIn(values, defaultLanguageCode, defaultLanguageCode) ?? "";
  };

  return {
    acceptanceLabel: text(content.acceptanceLabel),
    body: valueIn(content.body, locale, defaultLanguageCode) ?? {
      content: [],
      type: "doc",
    },
    locale,
    summary: text(content.summary),
    title: text(content.title),
  };
};

/**
 * The single language two versions are compared in: the requested one when
 * both have it, else the newer version's default language when both have it,
 * else the first language they share. `null` when they share none - each
 * side then falls back on its own. Browser-safe.
 */
export const pickLegalCompareLocale = (
  older: Pick<LegalLocalizedContent, "body" | "title">,
  newer: Pick<LegalLocalizedContent, "body" | "title">,
  requested: string,
  newerDefaultLanguageCode: string,
): null | string => {
  const olderLocales = new Set(legalAvailableLocales(older));
  const shared = legalAvailableLocales(newer).filter(code =>
    olderLocales.has(code),
  );
  if (shared.includes(requested)) return requested;
  if (shared.includes(newerDefaultLanguageCode)) {
    return newerDefaultLanguageCode;
  }

  return shared[0] ?? null;
};

/** Status of one announced version, derived from its dates and `now`. */
export type LegalVersionStatus = "current" | "past" | "upcoming";

/** Metadata of an announced version, as public history lists it. Browser-safe. */
export const zodLegalVersionMeta = z.object({
  id: z.number().int(),
  version: z.number().int(),
  documentType: zodLegalDocumentType,
  announcedAt: z.string(),
  effectiveAt: z.string(),
  requiresAcceptance: z.boolean(),
  status: z.enum(["current", "past", "upcoming"]),
  /** Title in the requested language, after fallback. */
  title: z.string(),
  /** Summary in the requested language, after fallback. */
  summary: z.string(),
  locale: z.string(),
  availableLocales: z.array(z.string()),
});

export type LegalVersionMeta = z.output<typeof zodLegalVersionMeta>;

/** One announced version in one language, as the public page renders it. Browser-safe. */
export const zodLegalVersionDocument = zodLegalVersionMeta.extend({
  body: zodRichTextDocument,
  acceptanceLabel: z.string(),
  /** The version this one replaced, if any. */
  previousVersion: z.number().int().nullable(),
  /** SHA-256 of the stored content, for evidence. */
  contentHash: z.string(),
});

export type LegalVersionDocument = z.output<typeof zodLegalVersionDocument>;

/** Public overview of one document type. Browser-safe. */
export const zodLegalDocumentOverview = z.object({
  documentType: zodLegalDocumentType,
  /** The effective version; `null` until the first one takes effect. */
  current: zodLegalVersionDocument.nullable(),
  /** An announced version that is not effective yet. */
  upcoming: zodLegalVersionMeta.nullable(),
  /** Every announced version, newest first. */
  history: z.array(zodLegalVersionMeta),
});

export type LegalDocumentOverview = z.output<typeof zodLegalDocumentOverview>;

/** Short links for the footer and sign-up form. Browser-safe. */
export const zodLegalLinks = z.object({
  terms: z
    .object({
      id: z.number().int(),
      version: z.number().int(),
      title: z.string(),
    })
    .nullable(),
  privacy: z
    .object({
      id: z.number().int(),
      version: z.number().int(),
      title: z.string(),
    })
    .nullable(),
});

export type LegalLinks = z.output<typeof zodLegalLinks>;

/** A member's legal state, as the session and gate read it. Browser-safe. */
export const zodLegalMemberState = z.object({
  /** Set while the member owes Terms acceptance. */
  pendingTerms: z
    .object({
      versionId: z.number().int(),
      version: z.number().int(),
      /** The last Terms version the member accepted, for the comparison. */
      lastAcceptedVersion: z.number().int().nullable(),
    })
    .nullable(),
  /** Informational notices the member has not dismissed. */
  notices: z.array(
    z.object({
      documentType: zodLegalDocumentType,
      versionId: z.number().int(),
      version: z.number().int(),
      previousVersion: z.number().int().nullable(),
      effectiveAt: z.string(),
      upcoming: z.boolean(),
      requiresAcceptance: z.boolean(),
    }),
  ),
  /**
   * When the next announced version takes effect, so an open tab can refresh
   * its state on time. `null` when nothing is scheduled.
   */
  nextChangeAt: z.string().nullable(),
});

export type LegalMemberState = z.output<typeof zodLegalMemberState>;

/** What `POST /legal/accept` takes. Browser-safe. */
export const zodLegalAcceptBody = z.object({
  /** The exact version shown to the member. */
  versionId: z.number().int().positive(),
  /** The language of the snapshot shown. */
  locale: z.string().min(1).max(32),
});

/** One comparison block. Browser-safe. */
export const zodLegalDiffBlock = z.object({
  kind: z.enum(["unchanged", "added", "removed", "changed"]),
  /** The block before (removed, changed, unchanged). */
  before: z.unknown().nullable(),
  /** The block after (added, changed, unchanged). */
  after: z.unknown().nullable(),
});

/** What the comparison endpoint answers. Browser-safe. */
export const zodLegalComparison = z.object({
  documentType: zodLegalDocumentType,
  from: zodLegalVersionMeta.nullable(),
  to: zodLegalVersionMeta,
  /** The language both sides are shown in; `null` when they share none. */
  locale: z.string().nullable(),
  /** The staff-authored summary of `to`, in `to`'s language. */
  summary: z.string(),
  blocks: z.array(zodLegalDiffBlock),
  stats: z.object({
    added: z.number().int(),
    removed: z.number().int(),
    changed: z.number().int(),
  }),
});

export type LegalComparison = z.output<typeof zodLegalComparison>;

/** One entry of a member's acceptance history. Browser-safe. */
export const zodLegalAcceptanceRecord = z.object({
  id: z.number().int(),
  documentType: zodLegalDocumentType,
  versionId: z.number().int(),
  version: z.number().int(),
  acceptedAt: z.string(),
  locale: z.string(),
  wording: z.string(),
  source: z.enum(["signup", "gate"]),
});

export type LegalAcceptanceRecord = z.output<typeof zodLegalAcceptanceRecord>;

/** Public path of a document type's current version, without a locale prefix. */
export const legalDocumentPath = (documentType: LegalDocumentType): string =>
  documentType === "terms" ? "/terms" : "/privacy";

/** Public path of one announced version. */
export const legalVersionPath = (
  documentType: LegalDocumentType,
  version: number,
): string => `${legalDocumentPath(documentType)}/versions/${version}`;

/** Public path of a version's comparison with its predecessor (or `from`). */
export const legalComparePath = (
  documentType: LegalDocumentType,
  version: number,
  from?: number,
): string =>
  `${legalVersionPath(documentType, version)}/changes${from === undefined ? "" : `?from=${from}`}`;

/** The page-cache tag every render of a document type's public pages carries. */
export const legalPageCacheTag = (documentType: LegalDocumentType): string =>
  `core:legal:${documentType}`;
