import type { QueryClient } from "@tanstack/react-query";

import type { ContentPublicationAction } from "@/content/publication";
import type { AnyContentTypeDefinition } from "@/content/types";
import type { ContentApiTarget } from "@/views/admin/views/content/content-request";
import type {
  ContentRowMutationArgs,
  ContentRowMutationResult,
} from "@/views/admin/views/content/table/list-mutations";
import type {
  ContentListPageFetcher,
  ContentListRequest,
} from "@/views/admin/views/content/table/list-query";

import {
  invalidateContentItem,
  invalidateContentList,
  removeContentItem,
  removeContentOptions,
} from "@/views/admin/views/content/lib/invalidate";
import {
  deleteContentInBrowser,
  setContentPublicationInBrowser,
} from "@/views/admin/views/content/table/list-mutations";
import {
  contentListPageFetcher,
  contentListQueryOptions,
} from "@/views/admin/views/content/table/list-query";

import type { ContentListParams } from "./route-search";

import { contentListQuery } from "./route-search";
import { contentApiFetch } from "./transport";

const fetchContentListPage: ContentListPageFetcher =
  contentListPageFetcher(contentApiFetch);

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
  }: { contentTypeId: string; itemId?: number; removed?: boolean },
): Promise<void> => {
  removeContentOptions(queryClient, contentTypeId);

  if (itemId !== undefined) {
    if (removed) removeContentItem(queryClient, contentTypeId, itemId);
    else await invalidateContentItem(queryClient, contentTypeId, itemId);
  }

  await invalidateContentList(queryClient, contentTypeId);
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
