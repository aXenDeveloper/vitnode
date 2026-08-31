import type { QueryClient } from "@tanstack/react-query";

import { createIsomorphicFn } from "@tanstack/react-start";

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
  contentListQueryOptions,
  fetchContentListPageInBrowser,
} from "@/views/admin/views/content/table/list-query";

import type { ContentListParams } from "./route-search";

import { contentListQuery } from "./route-search";
import { fetchContentListPageOnServer } from "./server";

/**
 * The Content Engine list for a TanStack Start host: one query definition, one
 * invalidation family, and the three writes a row performs.
 *
 * Everything about *what* the list is - the request, the response schema, the
 * cache key - is `views/admin/views/content/table/list-query.ts`, which is also
 * what the shared table renders from. This module supplies the two things that
 * module cannot know: how to reach the API from a server that is rendering a
 * request, and what "refresh the table" means in a router that has a query cache
 * instead of `revalidatePath`.
 */

/**
 * The transport boundary.
 *
 * Both branches call Hono directly - the server one from inside the request
 * being rendered, the browser one over the network to the same origin - and the
 * admin cookie travels on both. Written out per feature rather than hidden
 * behind a helper for the reason `tanstack/admin/cron/query.ts` gives: the
 * chained call is what the Start compiler reads to drop the server module from
 * the client bundle, and a wrapper defeats it.
 */
const fetchContentListPage: ContentListPageFetcher = createIsomorphicFn()
  .server(fetchContentListPageOnServer)
  .client(fetchContentListPageInBrowser);

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

/**
 * The request one content list URL is asking for, on the wire.
 *
 * The one place the viewing locale joins the URL contract, and it joins it only
 * for a content type that has translations. A list without them would otherwise
 * get one cache entry per AdminCP language, each holding identical rows.
 */
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

/**
 * The list, as the one query definition a loader warms and a screen reads back.
 *
 * Named `…PageQuery` rather than `contentListQuery`, which is already the URL
 * contract's flattener next door. Both sides of the route must call *this*, with
 * the same arguments, or the loader fills an entry the component never looks at.
 */
export const contentListPageQuery = (args: ContentListQueryArgs) =>
  contentListQueryOptions({
    fetchPage: fetchContentListPage,
    request: contentListRequestFor(args),
  });

/**
 * What a write to one record owes the rest of the AdminCP.
 *
 * Three prefixes, and each is a different kind of wrongness:
 *
 * - **The list**, because the row changed. Invalidated.
 * - **The record**, because its detail, its revisions, its schedules and its
 *   delivery state are all facts about a row that just moved. Invalidated, or
 *   *removed* when the record is gone - keeping a deleted record's history in
 *   memory only lets something render it.
 * - **Every reference picker onto this content type**, because an article's
 *   category picker is offering rows of this list. Removed rather than
 *   invalidated: the AdminCP's query client is configured `refetchOnMount:
 *   false`, so a merely-stale picker is still served from the cache the next
 *   time a form opens, and a deleted category stays on offer.
 *
 * The four narrow helpers it composes are in
 * `views/admin/views/content/lib/invalidate.ts`, shared with the Next.js
 * AdminCP - each names one prefix out of `content-query.ts`, and none of them
 * reaches above the one content type that was written to.
 */
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

/**
 * Marks every cached page, sort, search and filter of one content list stale.
 *
 * Re-exported rather than declared: the helper itself is
 * `views/admin/views/content/lib/invalidate.ts`, shared with the Next.js
 * AdminCP, and this keeps the import a content route already writes resolving.
 */
export { invalidateContentList };

export interface ContentRowWriteArgs extends ContentRowMutationArgs {
  contentTypeId: string;
}

/**
 * Publishes or unpublishes a row, then refreshes what it changed.
 *
 * Only on success. A refused publish left the record exactly where it was, and
 * refetching underneath the dialog that is still open - and still naming the
 * record - would replace the rows the administrator is being asked about.
 */
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
