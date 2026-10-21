import type { ContentFormSpec } from "@/content/admin/spec";

import {
  contentFormValuesToTranslations,
  isCollectionFieldSpec,
} from "@/content/admin/spec";

import type {
  ContentTranslationInput,
  TranslationRow,
} from "../content-mutation";

export const missingContentCollections = (
  spec: ContentFormSpec,
  data: Record<string, unknown>,
): string[] =>
  spec.fields
    .filter(isCollectionFieldSpec)
    .map(field => field.name)
    .filter(name => !Array.isArray(data[name]));

export const contentTranslationDiff = (
  spec: ContentFormSpec,
  submitted: Record<string, unknown>,
  opened: readonly TranslationRow[],
): ContentTranslationInput[] => {
  const byLocale = contentFormValuesToTranslations(spec, submitted);
  const entries: ContentTranslationInput[] = [];

  for (const [code, next] of Object.entries(byLocale)) {
    const existing = opened.find(
      row => row.locale.toLowerCase() === code.toLowerCase(),
    );

    if (!existing) {
      entries.push({ locale: code, values: next });
      continue;
    }

    const changed = Object.fromEntries(
      Object.entries(next).filter(
        ([name, value]) => existing.values[name] !== value,
      ),
    );
    if (Object.keys(changed).length === 0) continue;

    entries.push({
      expectedVersion: existing.version,
      locale: existing.locale,
      values: changed,
    });
  }

  return entries;
};

export const contentSharedChanged = (
  data: Record<string, unknown> | undefined,
  payload: Record<string, unknown>,
): boolean => {
  if (!data) return true;

  return Object.entries(payload).some(([name, value]) => {
    const before = data[name];

    if (Array.isArray(before) && Array.isArray(value)) {
      return (
        before.length !== value.length ||
        before.some((item, index) => item !== value[index])
      );
    }

    return before !== value;
  });
};

export interface IncompleteContentTranslation {
  locale: string;
  missing: string[];
}

export const splitIncompleteTranslations = (
  spec: ContentFormSpec,
  entries: readonly ContentTranslationInput[],
): {
  incomplete: IncompleteContentTranslation[];
  ready: ContentTranslationInput[];
} => {
  const required = spec.fields.filter(
    field => field.localized === true && field.required,
  );
  const defaultLocale = spec.defaultLocale?.toLowerCase() ?? null;
  const incomplete: IncompleteContentTranslation[] = [];
  const ready: ContentTranslationInput[] = [];

  for (const entry of entries) {
    const isNewSecondary =
      entry.expectedVersion === undefined &&
      entry.locale.toLowerCase() !== defaultLocale;
    const missing = isNewSecondary
      ? required
          .filter(field => entry.values[field.name] == null)
          .map(field => field.label)
      : [];

    if (missing.length > 0) {
      incomplete.push({ locale: entry.locale, missing });
    } else {
      ready.push(entry);
    }
  }

  return { incomplete, ready };
};
