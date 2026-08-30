import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import type { AnyContentTypeDefinition } from "@/content/types";

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

/**
 * What a **page-mode** content form opens on: one record, and every language of
 * it.
 *
 * The two reads `ContentEditPageView` performs before it renders anything, as
 * query definitions rather than as an awaited pair - so a TanStack Start loader
 * can warm exactly the entries the screen reads back, and the edit form is
 * populated in the first paint rather than after a round trip.
 *
 * ## Two entries rather than one
 *
 * They are separate facts about the record and they go stale separately: a save
 * that touched only the Polish copy leaves the base row exactly as it was. They
 * both hang off `contentItemQueryRoot`, so a write that moves the record
 * invalidates both by prefix - which is what `invalidateContentAfterWrite`
 * already does, with no list of keys to keep in step.
 *
 * ## A failed read rejects
 *
 * The opposite of the writes in `./mutations-api.ts`, and deliberately: an edit
 * form that renders empty because the record could not be read looks exactly
 * like an edit form for a record with nothing in it - and the first save would
 * then write those blanks over the real values. `readContentApiJson` throws, the
 * route's error boundary owns the screen, and nothing is editable.
 *
 * The Next.js AdminCP answers the same condition with `notFound()`, from the
 * server component that does the read. Both refuse to render a form; only the
 * screen the person lands on differs.
 */

/**
 * The row shape a form opens on: the record, plus its reference labels.
 *
 * `.loose()` carries the content type's own fields, which no generic schema can
 * enumerate - including `files`, which is where every `file` field's descriptor
 * lives. Dropping the unknown half would empty every field on the form.
 */
export const zodContentItem = z
  .object({
    id: z.number(),
    labels: z.record(z.string(), z.string().nullable()),
  })
  .loose();

export type ContentItem = Record<string, unknown> & { id: number };

/**
 * Every language of one record.
 *
 * `.loose()` on each edge for the same reason the row schema has it: a
 * translation's `values` are the content type's own localized fields, which no
 * generic schema can enumerate and which the form needs in full.
 */
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
  });

/** Every language of one record. Only ever asked for a localized content type. */
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
