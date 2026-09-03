import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import type { AnyContentTypeDefinition } from "@/content/types";

import { RECORD_STALE_TIME } from "@/lib/query-freshness";

import type { TranslationRow } from "../content-mutation";
import type { ContentApiTarget } from "../content-request";

import {
  contentItemQueryKey,
  contentTranslationsQueryKey,
} from "../content-query";
import {
  contentApiFetchInBrowser,
  readContentApiJson,
} from "../content-request";

export const zodContentItem = z
  .object({
    id: z.number(),
    labels: z.record(z.string(), z.string().nullable()),
  })
  .loose();

export type ContentItem = Record<string, unknown> & { id: number };

export const zodContentTranslationList = z.object({
  edges: z.array(z.object({ locale: z.string() }).loose()),
});

/** Which record is being read, and from which generated module. */
export interface ContentItemRequest {
  contentTypeId: string;
  itemId: number;
  target: ContentApiTarget;
}

/** What a failed read says it was reading. */
export const describeContentItem = ({
  contentTypeId,
  itemId,
}: ContentItemRequest): string => `${contentTypeId} #${itemId}`;

/** How the record itself is fetched - the seam a server render swaps. */
export type ContentItemFetcher = (
  request: ContentItemRequest,
) => Promise<ContentItem>;

/** How its translations are fetched. */
export type ContentTranslationsFetcher = (
  request: ContentItemRequest,
) => Promise<TranslationRow[]>;

export const fetchContentItemInBrowser: ContentItemFetcher = async request =>
  await readContentApiJson(
    await contentApiFetchInBrowser({
      method: "get",
      path: `/${request.itemId}`,
      target: request.target,
    }),
    { describe: describeContentItem(request), schema: zodContentItem },
  );

export const fetchContentTranslationsInBrowser: ContentTranslationsFetcher =
  async request =>
    (
      await readContentApiJson(
        await contentApiFetchInBrowser({
          method: "get",
          path: `/${request.itemId}/translations`,
          target: request.target,
        }),
        {
          describe: `${describeContentItem(request)} translations`,
          schema: zodContentTranslationList,
        },
      )
    ).edges as unknown as TranslationRow[];

/**
 * The record, as the one query definition a loader warms and a screen reads.
 *
 * Both sides **must** build it from this function with the same request, or the
 * loader fills an entry the component never looks at and the first paint costs a
 * round trip that was already paid for.
 *
 * `retry: false`, the rule every AdminCP read follows: a `404` on a record
 * somebody just deleted is an answer, a `403` is an answer, and a `429` is the
 * limiter asking for fewer requests rather than three of them.
 */
export const contentItemQueryOptions = ({
  fetchItem,
  request,
}: {
  fetchItem: ContentItemFetcher;
  request: ContentItemRequest;
}) =>
  queryOptions({
    queryFn: async () => await fetchItem(request),
    queryKey: contentItemQueryKey(request.contentTypeId, request.itemId),
    retry: false,
    /** {@link RECORD_STALE_TIME} - One record, whose version may have moved under a second editor. */
    staleTime: RECORD_STALE_TIME,
  });

/**
 * Every language of one record. Only ever asked for a localized content type.
 *
 * `retry: false`, for the reason {@link contentItemQueryOptions} gives.
 */
export const contentTranslationsQueryOptions = ({
  fetchTranslations,
  request,
}: {
  fetchTranslations: ContentTranslationsFetcher;
  request: ContentItemRequest;
}) =>
  queryOptions({
    queryFn: async () => await fetchTranslations(request),
    queryKey: contentTranslationsQueryKey(
      request.contentTypeId,
      request.itemId,
    ),
    retry: false,
  });

/**
 * The record's title, as the edit screen's heading and its toasts read it.
 *
 * The reading `ContentEditPageView` has always done, moved here because both
 * hosts need it and neither should own it: the title field may be localized, in
 * which case it is not on the row at all and has to come from the translation
 * for the language the administrator is reading in. A record with no usable
 * title falls back to `#id`, which is what the list's own title column does.
 */
export const contentItemTitle = ({
  definition,
  locale,
  row,
  translations,
}: {
  definition: AnyContentTypeDefinition;
  locale: string;
  row: ContentItem;
  translations: readonly TranslationRow[];
}): string => {
  const titleField = definition.admin.titleField;

  if (titleField === null) return `#${row.id}`;

  const raw =
    definition.fields[titleField]?.localized === true
      ? translations.find(
          entry => entry.locale.toLowerCase() === locale.toLowerCase(),
        )?.values[titleField]
      : row[titleField];

  return typeof raw === "string" && raw !== "" ? raw : `#${row.id}`;
};
