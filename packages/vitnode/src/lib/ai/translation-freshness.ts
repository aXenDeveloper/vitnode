import { fingerprint } from "@/content/hash";
import {
  isRichTextDocument,
  isRichTextEmpty,
} from "@/content/rich-text/document";
import { richTextToHtml } from "@/content/rich-text/html";
import { findLangValue } from "@/lib/helpers/multi-lang";

export type TranslationFreshness =
  | "edited"
  | "fresh"
  | "missing"
  | "outdated"
  | "untracked";

export interface TranslationSourceRecord {
  field: string;
  locale: string;
  sourceFingerprint: string;
  targetFingerprint: string;
}

const localeValue = (value: unknown, locale: string): unknown =>
  Array.isArray(value) ? findLangValue(value, locale) : value;

const textOf = (value: unknown, locale: string): string => {
  const localized = localeValue(value, locale);
  if (typeof localized === "string") return localized;
  if (isRichTextDocument(localized) && !isRichTextEmpty(localized)) {
    return richTextToHtml(localized);
  }

  return "";
};

export const fieldFingerprint = (value: unknown, locale: string): string =>
  fingerprint(textOf(value, locale));

export const translationFreshness = ({
  fields,
  locale,
  records,
  sourceLocale,
  values,
}: {
  fields: readonly string[];
  locale: string;
  records: readonly TranslationSourceRecord[];
  sourceLocale: string;
  values: Record<string, unknown>;
}): Record<string, TranslationFreshness> =>
  Object.fromEntries(
    fields.map(field => {
      if (textOf(values[field], locale).trim() === "")
        return [field, "missing"];
      const record = records.find(
        entry => entry.locale === locale && entry.field === field,
      );
      if (!record) return [field, "untracked"];
      if (
        fieldFingerprint(values[field], sourceLocale) !==
        record.sourceFingerprint
      ) {
        return [field, "outdated"];
      }

      return [
        field,
        fieldFingerprint(values[field], locale) === record.targetFingerprint
          ? "fresh"
          : "edited",
      ];
    }),
  );

export const outdatedTranslationFields = (
  freshness: Record<string, TranslationFreshness>,
): string[] =>
  Object.entries(freshness)
    .filter(([, status]) => status === "outdated")
    .map(([field]) => field);
