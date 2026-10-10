import type { ContentFormSpec } from "@/content/admin/spec";
import type { ContentDrafts } from "@/content/live/http";

import { isReferenceKind } from "@/content/admin/spec";

import type { ContentLiveDraftEvent } from "./use-session";

interface TranslationValues {
  locale: string;
  values: Record<string, unknown>;
}

export const sameContentValue = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export const contentDraftMovedReferences = (
  spec: ContentFormSpec,
  data: Record<string, unknown>,
  drafts: ContentDrafts | null,
): { field: string; id: number }[] =>
  Object.entries(drafts?.shared?.values ?? {}).flatMap(([name, value]) => {
    const fieldSpec = spec.fields.find(field => field.name === name);
    if (
      !fieldSpec ||
      fieldSpec.multiple === true ||
      !isReferenceKind(fieldSpec.kind) ||
      typeof value !== "number" ||
      sameContentValue(value, data[name])
    ) {
      return [];
    }

    return [{ field: name, id: value }];
  });

export const overlayContentDrafts = <
  TData extends Record<string, unknown>,
  TTranslation extends TranslationValues,
>(
  data: TData,
  translations: readonly TTranslation[],
  drafts: ContentDrafts | null,
  labels: Record<string, string> = {},
): { data: TData; translations: TranslationValues[] } => {
  if (!drafts) return { data, translations: [...translations] };

  const overlaid: TData = drafts.shared
    ? {
        ...data,
        ...drafts.shared.values,
        labels: {
          ...(typeof data.labels === "object" ? data.labels : null),
          ...labels,
        },
      }
    : data;

  const rows: TranslationValues[] = translations.map(row => {
    const draft = drafts.translations[row.locale];

    return draft ? { ...row, values: { ...row.values, ...draft.values } } : row;
  });
  for (const [locale, draft] of Object.entries(drafts.translations)) {
    if (!rows.some(row => row.locale === locale)) {
      rows.push({ locale, values: draft.values });
    }
  }

  return { data: overlaid, translations: rows };
};

export const mergeContentDraft = (
  drafts: ContentDrafts | null,
  event: ContentLiveDraftEvent,
): ContentDrafts => {
  const current = drafts ?? { shared: null, translations: {} };
  const previous =
    event.locale === null ? current.shared : current.translations[event.locale];
  const next = {
    baseVersion: previous?.baseVersion ?? 0,
    updatedAt: event.updatedAt,
    updatedBy: event.by ?? previous?.updatedBy ?? null,
    values: { ...previous?.values, ...event.values },
  };

  return event.locale === null
    ? { ...current, shared: next }
    : {
        ...current,
        translations: { ...current.translations, [event.locale]: next },
      };
};

export const contentDraftDiffers = (
  data: Record<string, unknown>,
  translations: readonly TranslationValues[],
  drafts: ContentDrafts | null,
): boolean => {
  if (!drafts) return false;

  const sharedDiffers = Object.entries(drafts.shared?.values ?? {}).some(
    ([name, value]) => !sameContentValue(value, data[name]),
  );
  if (sharedDiffers) return true;

  return Object.entries(drafts.translations).some(([locale, draft]) => {
    const row = translations.find(entry => entry.locale === locale);

    return Object.entries(draft.values).some(
      ([name, value]) => !sameContentValue(value, row?.values[name]),
    );
  });
};

export const contentDraftValue = (
  drafts: ContentDrafts | null,
  field: string,
  locale: null | string,
): undefined | { value: unknown } => {
  const values =
    locale === null
      ? drafts?.shared?.values
      : drafts?.translations[locale]?.values;

  return values && field in values ? { value: values[field] } : undefined;
};
