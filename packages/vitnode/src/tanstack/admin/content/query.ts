import type { QueryClient } from "@tanstack/react-query";

import type { ContentId } from "@/content/ids";
import type { ContentPublicationAction } from "@/content/publication";
import type { AnyContentTypeDefinition } from "@/content/types";
import type { ContentVisibilityAction } from "@/content/visibility";
import type { ContentApiTarget } from "@/views/admin/views/content/content-request";
import type { ContentItem } from "@/views/admin/views/content/form/item-query";
import type {
  ContentDuplicateInput,
  ContentDuplicateMutationResult,
  ContentRowMutationArgs,
  ContentRowMutationResult,
} from "@/views/admin/views/content/table/list-mutations";
import type { ContentListRequest } from "@/views/admin/views/content/table/list-query";

import {
  contentItemQueryOptions,
  contentItemTitle,
  contentTranslationsQueryOptions,
  fetchContentItem,
  fetchContentTranslations,
} from "@/views/admin/views/content/form/item-query";
import {
  invalidateContentItem,
  invalidateContentList,
  removeContentItem,
  removeContentOptions,
} from "@/views/admin/views/content/lib/invalidate";
import {
  deleteContentInBrowser,
  duplicateContentInBrowser,
  setContentPublicationInBrowser,
  setContentVisibilityInBrowser,
} from "@/views/admin/views/content/table/list-mutations";
import {
  contentListQueryOptions,
  fetchContentListPage,
} from "@/views/admin/views/content/table/list-query";
import { SEARCH_QUERY_ROOT } from "@/views/search/search-feed-query";

import type { ContentListParams } from "./route-search";

import { contentListQuery } from "./route-search";

/** Which generated module serves one content type's admin routes. */
export const contentApiTarget = (
  definition: AnyContentTypeDefinition,
  pluginId: string,
): ContentApiTarget => ({
  permissionModule: definition.permissionModule,
  pluginId,
});

export interface ContentListQueryArgs {
  definition: AnyContentTypeDefinition;
  /** The administrator's own AdminCP language. */
  locale: string;
  /** The **normalised** URL contract - see `./route-search`. */
  params: ContentListParams;
  pluginId: string;
}

export const contentListRequestFor = ({
  definition,
  locale,
  params,
  pluginId,
}: ContentListQueryArgs): ContentListRequest => ({
  contentTypeId: definition.id,
  ...(definition.localization.enabled ? { locale } : {}),
  query: contentListQuery(params),
  target: contentApiTarget(definition, pluginId),
});

export const contentListPageQuery = (args: ContentListQueryArgs) =>
  contentListQueryOptions({
    fetchPage: fetchContentListPage,
    request: contentListRequestFor(args),
  });

export const invalidateContentAfterWrite = async (
  queryClient: QueryClient,
  {
    contentTypeId,
    itemId,
    removed = false,
  }: { contentTypeId: string; itemId?: ContentId; removed?: boolean },
): Promise<void> => {
  removeContentOptions(queryClient, contentTypeId);

  if (itemId !== undefined) {
    if (removed) removeContentItem(queryClient, contentTypeId, itemId);
    else await invalidateContentItem(queryClient, contentTypeId, itemId);
  }

  await Promise.all([
    invalidateContentList(queryClient, contentTypeId),
    queryClient.invalidateQueries({ queryKey: SEARCH_QUERY_ROOT }),
  ]);
};

export const invalidateContentAfterBulkWrite = async (
  queryClient: QueryClient,
  {
    contentTypeId,
    itemIds,
    removed,
  }: { contentTypeId: string; itemIds: readonly ContentId[]; removed: boolean },
): Promise<void> => {
  removeContentOptions(queryClient, contentTypeId);

  await Promise.all([
    ...itemIds.map(async itemId => {
      if (removed) removeContentItem(queryClient, contentTypeId, itemId);
      else await invalidateContentItem(queryClient, contentTypeId, itemId);
    }),
    invalidateContentList(queryClient, contentTypeId),
    queryClient.invalidateQueries({ queryKey: SEARCH_QUERY_ROOT }),
  ]);
};

export { invalidateContentList };

export interface ContentRowWriteArgs extends ContentRowMutationArgs {
  contentTypeId: string;
}

export const setContentPublication = async (
  queryClient: QueryClient,
  {
    action,
    contentTypeId,
    id,
    target,
  }: ContentRowWriteArgs & {
    /** The transition to perform, from `contentPublicationTransition`. */
    action: ContentPublicationAction;
  },
): Promise<ContentRowMutationResult> => {
  const result = await setContentPublicationInBrowser({
    action,
    id,
    target,
  });

  if (result.error === undefined) {
    await invalidateContentAfterWrite(queryClient, {
      contentTypeId,
      itemId: id,
    });
  }

  return result;
};

/** Copies a row as a draft, then refreshes the list it will appear in. */
export const duplicateContentRow = async (
  queryClient: QueryClient,
  {
    contentTypeId,
    id,
    input,
    target,
  }: ContentRowWriteArgs & { input?: ContentDuplicateInput },
): Promise<ContentDuplicateMutationResult> => {
  const result = await duplicateContentInBrowser({ id, input, target });

  if (result.error === undefined) {
    await invalidateContentAfterWrite(queryClient, { contentTypeId });
  }

  return result;
};

/**
 * Hides or unhides a row, then refreshes everything that showed it.
 *
 * `expectedVersion` is the version the row was rendered at; an editorial
 * content type answers a stale one with a `409` instead of acting on a record
 * somebody else just changed.
 */
export const setContentVisibility = async (
  queryClient: QueryClient,
  {
    action,
    contentTypeId,
    expectedVersion,
    id,
    target,
  }: ContentRowWriteArgs & {
    /** The transition to perform, from `contentVisibilityTransition`. */
    action: ContentVisibilityAction;
    expectedVersion?: number;
  },
): Promise<ContentRowMutationResult> => {
  const result = await setContentVisibilityInBrowser({
    action,
    expectedVersion,
    id,
    target,
  });

  if (result.error === undefined) {
    await invalidateContentAfterWrite(queryClient, {
      contentTypeId,
      itemId: id,
    });
  }

  return result;
};

/**
 * The copy a duplicate just made, read the way its edit screen reads it.
 *
 * Through the same query definitions the edit page's loader uses, so the
 * navigation that follows paints from the cache - and so a localized title,
 * which is not on the duplicate's base row, comes from the copy's own
 * translation rather than from a guess about the suffix the server added.
 * Falls back to the duplicate's own row when the read fails: the copy exists
 * either way, and the toast and the hand-off must not depend on a second
 * request.
 */
export const readDuplicatedContent = async (
  queryClient: QueryClient,
  {
    definition,
    fallback,
    id,
    locale,
    pluginId,
  }: {
    definition: AnyContentTypeDefinition;
    /** The `row` the duplicate answered with. */
    fallback: Record<string, unknown>;
    id: ContentId;
    /** The language the administrator reads the AdminCP in. */
    locale: string;
    pluginId: string;
  },
): Promise<{ row: ContentItem; title: string }> => {
  const request = {
    contentTypeId: definition.id,
    itemId: id,
    target: contentApiTarget(definition, pluginId),
  };
  const base: ContentItem = { ...fallback, id: request.itemId };

  try {
    const [row, translations] = await Promise.all([
      queryClient.query({
        ...contentItemQueryOptions({ fetchItem: fetchContentItem, request }),
      }),
      definition.localization.enabled
        ? queryClient.query({
            ...contentTranslationsQueryOptions({
              fetchTranslations: fetchContentTranslations,
              request,
            }),
          })
        : Promise.resolve([]),
    ]);

    return {
      row,
      title: contentItemTitle({ definition, locale, row, translations }),
    };
  } catch {
    return {
      row: base,
      title: contentItemTitle({
        definition,
        locale,
        row: base,
        translations: [],
      }),
    };
  }
};

/** Deletes a row, then drops everything that was about it. */
export const deleteContentRow = async (
  queryClient: QueryClient,
  {
    contentTypeId,
    editorial,
    id,
    target,
    version,
  }: ContentRowWriteArgs & {
    editorial: boolean;
    version?: number;
  },
): Promise<ContentRowMutationResult> => {
  const result = await deleteContentInBrowser({
    editorial,
    id,
    target,
    version,
  });

  if (result.error === undefined) {
    await invalidateContentAfterWrite(queryClient, {
      contentTypeId,
      itemId: id,
      removed: true,
    });
  }

  return result;
};
