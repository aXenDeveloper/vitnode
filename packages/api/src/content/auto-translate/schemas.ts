import { z } from "zod";

import { zodRichTextDocument } from "../rich-text/document";

/** Most records one lookup or request may name. */
export const AUTO_TRANSLATE_MAX_ITEMS = 30;
/** Most fields one record may name. */
export const AUTO_TRANSLATE_MAX_FIELDS = 4;

/** Name of the cookie that keeps a guest's choice. `0` is off, `1` is on. */
export const AUTO_TRANSLATE_COOKIE = "vitnode-auto-translate";

export const zodAutoTranslateLocale = z
  .string()
  .min(2)
  .max(32)
  .regex(/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u);

export const zodAutoTranslateItem = z.object({
  contentTypeId: z.string().min(1).max(150),
  fields: z
    .array(
      z.object({
        /**
         * The fingerprint of the value the page renders. A different
         * authoritative fingerprint answers `stale` instead of a translation.
         */
        fingerprint: z
          .string()
          .regex(/^[0-9a-f]{64}$/u)
          .optional(),
        name: z.string().min(1).max(100),
      }),
    )
    .min(1)
    .max(AUTO_TRANSLATE_MAX_FIELDS),
  id: z.union([z.number().int().positive(), z.string().min(1).max(64)]),
});

export const zodAutoTranslateLookupBody = z.object({
  items: z.array(zodAutoTranslateItem).min(1).max(AUTO_TRANSLATE_MAX_ITEMS),
  locale: zodAutoTranslateLocale,
});

export const zodAutoTranslateRequestBody = zodAutoTranslateLookupBody.extend({
  /**
   * `automatic` follows every skip rule; `manual` is the reader's own
   * Translate click and also accepts a single word or an uncertain language.
   */
  mode: z.enum(["automatic", "manual"]),
  /** A supported source language the reader picked, for a manual request. */
  sourceLocale: zodAutoTranslateLocale.optional(),
});

export const AUTO_TRANSLATE_STATES = [
  "missing",
  "original",
  "pending",
  "ready",
  "skipped",
  "stale",
  "unavailable",
] as const;

export type AutoTranslateState = (typeof AUTO_TRANSLATE_STATES)[number];

export const AUTO_TRANSLATE_REASONS = [
  "acknowledgment",
  "budget",
  "disabled",
  "failed",
  "limited",
  "locale",
  "no_text",
  "not_found",
  "sign_in",
  "single_word",
  "too_long",
  "uncertain_language",
  "unsupported_language",
] as const;

export type AutoTranslateReason = (typeof AUTO_TRANSLATE_REASONS)[number];

export const zodAutoTranslateFieldResult = z.object({
  /** The authoritative fingerprint, or `null` when the record is not readable. */
  fingerprint: z.string().nullable(),
  name: z.string(),
  reason: z.enum(AUTO_TRANSLATE_REASONS).optional(),
  /** The detected or known language of the source, when there is one. */
  sourceLocale: z.string().nullable().optional(),
  state: z.enum(AUTO_TRANSLATE_STATES),
  /** The translated value, only with `ready`. */
  value: z.union([z.string(), zodRichTextDocument]).optional(),
});

export type AutoTranslateFieldResult = z.infer<
  typeof zodAutoTranslateFieldResult
>;

export const zodAutoTranslateResponse = z.object({
  items: z.array(
    z.object({
      contentTypeId: z.string(),
      fields: z.array(zodAutoTranslateFieldResult),
      id: z.string(),
    }),
  ),
  locale: z.string(),
});

export type AutoTranslateResponse = z.infer<typeof zodAutoTranslateResponse>;

export const zodAutoTranslateSettingsResponse = z.object({
  /** The reader's effective choice: their own, or on by default. */
  auto: z.boolean(),
  /** Whether this reader may start new translations (signed in). */
  canGenerate: z.boolean(),
  /** Whether the site turned automatic translation on. */
  enabled: z.boolean(),
  /** Languages translations are made into and from. */
  locales: z.array(z.string()),
});

export type AutoTranslateSettings = z.infer<
  typeof zodAutoTranslateSettingsResponse
>;
