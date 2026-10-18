import { useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";

import type { ContentId } from "@/content/ids";
import type { TranslationSourceRecord } from "@/lib/ai/translation-freshness";

import {
  fieldFingerprint,
  translationFreshness,
} from "@/lib/ai/translation-freshness";
import { fetcher } from "@/tanstack/fetcher";

import { useContentForm } from "./context";

interface PendingRecord<Field extends string> {
  field: Field;
  locale: string;
  origin: "ai" | "human";
  sourceFingerprint: string;
}

const recordsKey = (contentTypeId: string, itemId: ContentId) => [
  "ai",
  "translation-sources",
  contentTypeId,
  itemId,
];

/**
 * Tracks whether each translated field still matches its source-language
 * text, for a localized content form. Must render inside the content form
 * (it uses `useContentForm`). Records load for an existing item only.
 *
 * Returns:
 * - `freshnessOf(locale)`: per field, `missing` (empty), `untracked` (no
 *   record), `outdated` (the source text changed since), `edited` (changed
 *   after it was translated) or `fresh`.
 * - `outdatedFields(locale)` and `editedByPerson(locale, field)`.
 * - `rememberAiTranslation(locale, field)` and `markReviewed(locale, fields)`:
 *   queue a record; queued records are written after the form saves, one
 *   request per locale.
 */
export const useTranslationFreshness = <Field extends string>({
  contentTypeId,
  fields,
  itemId,
  source,
  values,
}: {
  contentTypeId: string;
  /** The localized fields to track. */
  fields: readonly Field[];
  /** The record being edited; `undefined` while creating. */
  itemId: ContentId | undefined;
  /** The source locale translations are compared against. */
  source: string;
  /** The form's current values for `fields`. */
  values: Partial<Record<Field, unknown>>;
}) => {
  const queryClient = useQueryClient();
  const { onSaved } = useContentForm();
  const pendingRef = React.useRef(new Map<string, PendingRecord<Field>>());
  const valuesRef = React.useRef(values);
  React.useEffect(() => {
    valuesRef.current = values;
  });

  const { data: records = [] } = useQuery({
    enabled: itemId !== undefined,
    queryFn: async (): Promise<TranslationSourceRecord[]> => {
      const response = await fetcher({
        plugin: "@vitnode/core",
        method: "get",
        module: "admin/ai",
        path: "/translation-sources",
        args: { query: { contentTypeId, itemId: itemId ?? 0 } },
      });
      if (!response.ok) return [];

      return (await response.json()).records;
    },
    queryKey: recordsKey(contentTypeId, itemId ?? 0),
  });

  React.useEffect(
    () =>
      onSaved?.(async ({ itemId: savedId }) => {
        const entries = [...pendingRef.current.values()];
        if (entries.length === 0) return;
        pendingRef.current.clear();
        const byLocale = Map.groupBy(entries, entry => entry.locale);
        await Promise.all(
          [...byLocale].map(async ([locale, group]) => {
            await fetcher({
              plugin: "@vitnode/core",
              method: "put",
              module: "admin/ai",
              path: "/translation-sources",
              args: {
                body: {
                  contentTypeId,
                  fields: group.map(entry => ({
                    field: entry.field,
                    origin: entry.origin,
                    sourceFingerprint: entry.sourceFingerprint,
                    targetFingerprint: fieldFingerprint(
                      valuesRef.current[entry.field],
                      locale,
                    ),
                  })),
                  itemId: savedId,
                  locale,
                  sourceLocale: source,
                },
              },
            });
          }),
        );
        await queryClient.invalidateQueries({
          queryKey: recordsKey(contentTypeId, savedId),
        });
      }),
    [contentTypeId, onSaved, queryClient, source],
  );

  const freshnessOf = (locale: string) =>
    translationFreshness({
      fields,
      locale,
      records,
      sourceLocale: source,
      values,
    });

  const editedByPerson = (locale: string, field: Field) => {
    const record = records.find(
      entry => entry.locale === locale && entry.field === field,
    );

    return (
      record !== undefined &&
      fieldFingerprint(values[field], locale) !== record.targetFingerprint
    );
  };

  const remember = (
    locale: string,
    field: Field,
    origin: PendingRecord<Field>["origin"],
  ) => {
    pendingRef.current.set(`${locale}:${field}`, {
      field,
      locale,
      origin,
      sourceFingerprint: fieldFingerprint(valuesRef.current[field], source),
    });
  };

  return {
    editedByPerson,
    freshnessOf,
    outdatedFields: (locale: string) =>
      Object.entries(freshnessOf(locale))
        .filter(([, status]) => status === "outdated")
        .map(([field]) => field as Field),
    rememberAiTranslation: (locale: string, field: Field) => {
      remember(locale, field, "ai");
    },
    markReviewed: (locale: string, reviewed: readonly Field[]) => {
      for (const field of reviewed) remember(locale, field, "human");
    },
  };
};
