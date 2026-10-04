import { fingerprint } from "@/content/hash";
import { getLangValue } from "@/lib/helpers/multi-lang";

/**
 * - `fresh`: translated from the source as it is now;
 * - `edited`: as above, and a person changed the translation since - their
 *   changes are kept;
 * - `outdated`: the source changed after the translation was made;
 * - `untracked`: no record of what it was translated from - no claim either way;
 * - `missing`: nothing translated yet.
 */
export type TranslationFreshness =
  "edited" | "fresh" | "missing" | "outdated" | "untracked";

export interface TranslationSourceRecord {
  field: string;
  locale: string;
  sourceFingerprint: string;
  targetFingerprint: string;
}

type FieldValue =
  string | undefined | { languageCode: string; value: string }[];

export const fieldFingerprint = (value: unknown, locale: string): string =>
  fingerprint(
    typeof value === "string" || Array.isArray(value)
      ? getLangValue(value as FieldValue, locale)
      : "",
  );

const textOf = (value: unknown, locale: string): string =>
  typeof value === "string" || Array.isArray(value)
    ? getLangValue(value as FieldValue, locale)
    : "";

/** Field-level freshness of one translation, from source fingerprints. */
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

/** Fields of one translation whose source changed since they were translated. */
export const outdatedTranslationFields = (
  freshness: Record<string, TranslationFreshness>,
): string[] =>
  Object.entries(freshness)
    .filter(([, status]) => status === "outdated")
    .map(([field]) => field);
