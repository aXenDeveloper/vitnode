import type { QueryClient } from "@tanstack/react-query";
import type { AutoTranslateResponse } from "@vitnode/api/content/auto-translate";

import { autoTranslateFingerprint } from "@vitnode/api/content/auto-translate";

import type { AutoTranslateItemRequest } from "./query";
import type { AutoTranslateSnapshot } from "./scope";

import { sessionQueryOptions } from "../auth/session-query";
import {
  autoTranslateSettingsQueryOptions,
  chunkAutoTranslateItems,
  lookupAutoTranslations,
} from "./query";

/**
 * One record as a translation request names it: its content type, id, and
 * the fingerprint of every field value the page renders. Browser-safe.
 *
 * On a localized content type pass the record's public `locale` as
 * `recordLocale`: the language it was served in, which the server folds into
 * the fingerprint.
 *
 * @example
 * ```ts
 * autoTranslateItem("forum.topic", topic.id, { body: topic.body });
 * autoTranslateItem("blog.post", post.id, { content: post.content }, { recordLocale: post.locale });
 * ```
 */
export const autoTranslateItem = (
  contentTypeId: string,
  id: number | string,
  fields: Record<string, unknown>,
  { recordLocale = null }: { recordLocale?: null | string } = {},
): AutoTranslateItemRequest => ({
  contentTypeId,
  fields: Object.entries(fields).map(([name, value]) => ({
    fingerprint: autoTranslateFingerprint({
      field: name,
      sourceLocale: recordLocale,
      value,
    }),
    name,
  })),
  id,
});

/**
 * Reads, in a route loader, the reader's settings and every saved translation
 * of the records a page renders, in batches of 30 - so a ready translation
 * is on the first render. Read-only: it never starts a translation. Never
 * throws; a failure only means the page starts with the originals.
 *
 * @example
 * ```ts
 * const translations = await loadAutoTranslateSnapshot(context.queryClient, {
 *   items: topics.map(topic => autoTranslateItem("forum.topic", topic.id, { body: topic.body })),
 *   locale: context.locale,
 * });
 * ```
 */
export const loadAutoTranslateSnapshot = async (
  queryClient: QueryClient,
  { items, locale }: { items: AutoTranslateItemRequest[]; locale: string },
): Promise<AutoTranslateSnapshot | null> => {
  try {
    const session = await queryClient
      .query(sessionQueryOptions())
      .catch(() => null);
    const settings = await queryClient.query(
      autoTranslateSettingsQueryOptions(session?.user?.id ?? null),
    );
    if (!settings.enabled || items.length === 0) {
      return { items: [], locale, response: null, settings };
    }

    const responses = await Promise.all(
      chunkAutoTranslateItems(items).map(
        async chunk => await lookupAutoTranslations({ items: chunk, locale }),
      ),
    );
    const response: AutoTranslateResponse = {
      items: responses.flatMap(entry => entry?.items ?? []),
      locale,
    };

    return { items, locale, response, settings };
  } catch {
    return null;
  }
};
