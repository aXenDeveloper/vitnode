import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import type {
  AdminTablePage,
  AdminTablePageInfo,
} from "@/views/admin/table/params";

import { RECORD_STALE_TIME } from "@/lib/query-freshness";

import type { ContentApiRequest, ContentApiTarget } from "../content-request";
import type { ContentRowData } from "./cells";

import { contentListQueryKey } from "../content-query";
import {
  contentApiFetchInBrowser,
  readContentApiJson,
} from "../content-request";

/** One page of an admin content list. */
export type ContentListPage = AdminTablePage<ContentRowData>;

const zodPageInfo = z.object({
  count: z.number(),
  endCursor: z.string().nullable(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
  startCursor: z.string().nullable(),
  totalCount: z.number(),
});

const zodListRow = z
  .object({
    id: z.number(),
    labels: z.record(z.string(), z.string().nullable()),
    translation: z
      .object({
        locale: z.string(),
        status: z.string().optional(),
        title: z.string(),
        values: z.record(z.string(), z.unknown()),
      })
      .nullable()
      .optional(),
  })
  .loose();

export const zodContentListPage = z.object({
  edges: z.array(zodListRow),
  pageInfo: zodPageInfo,
});

const _pageInfoMatches: AdminTablePageInfo = {} as z.infer<typeof zodPageInfo>;
void _pageInfoMatches;

export interface ContentListRequest {
  contentTypeId: string;

  locale?: string;
  query: Record<string, string | undefined>;
  target: ContentApiTarget;
}

export const contentListWireQuery = ({
  locale,
  query,
}: Pick<ContentListRequest, "locale" | "query">): Record<string, string> =>
  Object.fromEntries(
    Object.entries({
      ...query,
      ...(locale === undefined ? {} : { locale }),
    })
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)),
  );

/** Where one page of one content list is cached. */
export const contentListRequestKey = (
  request: ContentListRequest,
): readonly unknown[] =>
  contentListQueryKey(request.contentTypeId, contentListWireQuery(request));

/** The generated route this request addresses. */
export const contentListApiRequest = (
  request: ContentListRequest,
): ContentApiRequest => ({
  method: "get",
  query: contentListWireQuery(request),
  target: request.target,
});

export type ContentListPageFetcher = (
  request: ContentListRequest,
  /**
   * The read's cancellation. Optional so the SSR branch - handed no signal,
   * deliberately - satisfies this with one parameter.
   */
  options?: { signal?: AbortSignal },
) => Promise<ContentListPage>;

/** What a failed read says it was reading. */
export const describeContentList = (request: ContentListRequest): string =>
  `the ${request.contentTypeId} list`;

/**
 * One page, fetched from the browser against the same origin.
 *
 * `readContentApiJson` throws on a refusal and on a schema mismatch, and an
 * abort throws earlier still - `fetch` rejects before there is a response to
 * parse. So a cancelled sort cannot reach the table as a content type with no
 * records in it, which is the one thing a list must never look like.
 */
export const fetchContentListPageInBrowser: ContentListPageFetcher = async (
  request,
  { signal } = {},
) =>
  await readContentApiJson(
    await contentApiFetchInBrowser(contentListApiRequest(request), { signal }),
    {
      describe: describeContentList(request),
      schema: zodContentListPage,
    },
  );

/**
 * The list, as the query definition a loader warms and a component reads back.
 *
 * Both sides **must** build it from this function with the same request, or the
 * loader fills an entry the component never looks at and the first paint costs a
 * round trip that was already paid for.
 *
 * `retry: false`, which is the rule every other AdminCP read follows and the one
 * the Content Engine was missing. A `403` - this administrator lost `can_view`
 * while the table was open - will not become a `200` because we asked twice
 * more, and a `429` answered with two more requests is precisely what the
 * limiter asked the application to stop doing. The failure belongs on screen
 * immediately, not after three attempts and exponential backoff.
 */
export const contentListQueryOptions = ({
  fetchPage,
  request,
}: {
  fetchPage: ContentListPageFetcher;
  request: ContentListRequest;
}) =>
  queryOptions({
    // Reads `signal`, which is the only thing that marks a query cancellable.
    // Typing in the table's search box, or paging through it, leaves one request
    // in flight rather than one per keystroke - and the abandoned ones reject
    // rather than landing late over the rows being read.
    queryFn: async ({ signal }) => await fetchPage(request, { signal }),
    queryKey: contentListRequestKey(request),
    retry: false,
    /** {@link RECORD_STALE_TIME} - Records are written by editors; a publish elsewhere is exactly what this catches. */
    staleTime: RECORD_STALE_TIME,
  });
