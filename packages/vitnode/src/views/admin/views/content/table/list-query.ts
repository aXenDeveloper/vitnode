import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import type {
  AdminTablePage,
  AdminTablePageInfo,
} from "@/views/admin/table/params";

import type { ContentApiRequest, ContentApiTarget } from "../content-request";
import type { ContentRowData } from "./cells";

import { contentListQueryKey } from "../content-query";
import {
  contentApiFetchInBrowser,
  readContentApiJson,
} from "../content-request";

/**
 * One page of a Content Engine list, as the **one** query definition every
 * caller shares.
 *
 * Framework-neutral and transport-free in the same sense the rest of
 * `views/admin/views/content/` is: it says what the request is, what comes back
 * and where the answer is cached, and takes *how to fetch it* as an argument. A
 * TanStack Start host binds that to an isomorphic function
 * (`tanstack/admin/content/query.ts`); the Next.js list stays on its own server
 * fetch, because a Server Component has no query cache to read from.
 *
 * ## The key is the request, and the request is the key
 *
 *     ["vitnode","admin","content","blog.post","list",{first:"25",locale:"pl"}]
 *
 * {@link contentListWireQuery} builds that object once and it is used for both:
 * the query string that goes on the wire and the last segment of the cache key.
 * They cannot drift, which is the whole point - a parameter that reaches the API
 * without reaching the key makes two different requests share one entry, and the
 * table then renders the other one's rows.
 *
 * Everything in it is a string. There is deliberately no function, no component,
 * no query client and no registration object anywhere near a key: TanStack Query
 * hashes keys structurally, so a component reference in one would make every
 * render a cache miss, and a registration object would put a plugin's whole
 * override map in the cache index.
 *
 * `target` is *not* in the key even though it is part of the request, because it
 * is a function of the content type id - one content type is served by exactly
 * one generated module - and a key segment that can never vary independently is
 * noise the hash pays for on every lookup.
 *
 * ## A failed read throws
 *
 * {@link readContentApiJson} rejects on a non-2xx and on a body the content type
 * does not describe. That is the difference between a list that says something
 * went wrong and a list that renders zero rows - and zero rows is
 * indistinguishable from a content type nobody has created a record in yet,
 * which is the one thing an operational screen must never look like.
 */

/** One page of an admin content list. */
export type ContentListPage = AdminTablePage<ContentRowData>;

/**
 * The pager's own state.
 *
 * Declared here rather than imported from `api/lib/with-pagination`: that module
 * is the API's, and it reaches Drizzle and Hono. A browser bundle has no
 * business holding either, and the list screen is in one. The assignment below
 * is what keeps this reading of the schema honest.
 */
const zodPageInfo = z.object({
  count: z.number(),
  endCursor: z.string().nullable(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
  startCursor: z.string().nullable(),
  totalCount: z.number(),
});

/**
 * One row, as loosely as a *generic* list can describe one.
 *
 * The three keys named are the ones every content type's list response carries
 * and every cell may read; the rest of the row is the content type's own fields,
 * which this schema cannot enumerate and must not drop - `.loose()` is what
 * carries them, `files` included.
 *
 * `translation` is present only on a localized content type, which is why it is
 * optional as well as nullable: absent means "this content type has no
 * translations", `null` means "this record has none in the language being read",
 * and the cell renderer says different things about the two.
 */
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

/**
 * The schema really does describe the page the rest of the AdminCP renders.
 *
 * A compile-time assignment rather than a test, because it costs nothing and
 * catches the only way these two drift: renaming a field on one side. If the API
 * grows a page-info field, this stops compiling here rather than rendering a
 * pager with a missing button.
 */
const _pageInfoMatches: AdminTablePageInfo = {} as z.infer<typeof zodPageInfo>;
void _pageInfoMatches;

/**
 * Everything that decides which rows come back.
 *
 * `query` is the URL contract already flattened - pagination, ordering, search
 * and this content type's filters, as `contentListQuery` in
 * `tanstack/admin/content/route-search.ts` produces it. It arrives flattened
 * rather than as the structured params because *this* module has no business
 * knowing which keys a content type accepts as filters; that is a question about
 * a definition, and the URL contract already answered it.
 */
export interface ContentListRequest {
  contentTypeId: string;
  /**
   * The language the list is read in, for a localized content type.
   *
   * Not a filter and never in the URL: it is the administrator's own AdminCP
   * language, and the API is explicit that it does not hide records nobody has
   * translated yet - it resolves one translation per row and says so. It is in
   * the cache key because it changes every localized cell on the page.
   *
   * Left out entirely for a content type without localization, so those lists
   * do not get one cache entry per language holding identical rows.
   */
  locale?: string;
  query: Record<string, string | undefined>;
  target: ContentApiTarget;
}

/**
 * The request as one flat, sorted, string-valued object.
 *
 * Sorted so two spellings of one request hash to one entry, and `undefined`
 * dropped so "no search" is the absence of a key rather than a key whose value
 * happens to be missing - the two hash differently.
 */
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

/**
 * How a page is actually fetched.
 *
 * The seam between this module and a host: the browser implementation below is
 * the whole of it in a client-rendered navigation, and a TanStack Start server
 * render swaps in one that forwards the incoming request's admin cookie.
 */
export type ContentListPageFetcher = (
  request: ContentListRequest,
) => Promise<ContentListPage>;

/** What a failed read says it was reading. */
export const describeContentList = (request: ContentListRequest): string =>
  `the ${request.contentTypeId} list`;

/** One page, fetched from the browser against the same origin. */
export const fetchContentListPageInBrowser: ContentListPageFetcher =
  async request =>
    await readContentApiJson(
      await contentApiFetchInBrowser(contentListApiRequest(request)),
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
 */
export const contentListQueryOptions = ({
  fetchPage,
  request,
}: {
  fetchPage: ContentListPageFetcher;
  request: ContentListRequest;
}) =>
  queryOptions({
    queryFn: async () => await fetchPage(request),
    queryKey: contentListRequestKey(request),
  });
