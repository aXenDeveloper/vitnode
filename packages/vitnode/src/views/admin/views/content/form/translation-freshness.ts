import { useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";

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

const recordsKey = (contentTypeId: string, itemId: number) => [
  "ai",
  "translation-sources",
  contentTypeId,
  itemId,
];

/**
 * Field-level translation freshness for one article, from what each field
 * was translated from - never from timestamps. A new AI translation (or a
 * "mark as up to date") is remembered and recorded only once the article is
 * saved, so the record always describes text that was actually kept.
 */
export const useTranslationFreshness = <Field extends string>({
  contentTypeId,
  fields,
  itemId,
  source,
  values,
}: {
  contentTypeId: string;
  fields: readonly Field[];
  itemId: number | undefined;
  source: string;
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
        for (const [locale, group] of byLocale) {
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
        }
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
      values: values,
    });

  /** Outdated fields a person changed since the AI wrote them - never overwritten automatically. */
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
    /** After an AI translation is placed in the form. Recorded on save. */
    rememberAiTranslation: (locale: string, field: Field) => {
      remember(locale, field, "ai");
    },
    /** A person confirms these translations match today's source. Recorded on save. */
    markReviewed: (locale: string, reviewed: readonly Field[]) => {
      for (const field of reviewed) remember(locale, field, "human");
    },
  };
};
