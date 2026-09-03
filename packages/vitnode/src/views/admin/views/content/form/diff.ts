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
