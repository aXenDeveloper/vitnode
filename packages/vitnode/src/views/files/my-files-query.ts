import { queryOptions } from "@tanstack/react-query";

import type { userFilesModule } from "@/api/modules/users/files/files.module";

import { DEFAULT_TABLE_PAGE_SIZE } from "@/components/table/url-state";
import { CONFIG_PLUGIN } from "@/config";
import { clientModule, fetcherClient } from "@/lib/fetcher-client";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";

/**
 * The signed-in visitor's own files, as one query definition.
 *
 * Everything about *what* that list is lives here and nowhere else: which URL
 * parameters mean something, what a page is, how a refusal is told apart from a
 * page, and the cache entry the whole thing lands in. A view renders whatever
 * this produces and owns none of it.
 *
 * The split is the lesson `search-feed-query.ts` already paid for. When a
 * component built one request and a loader built another, the two agreed on the
 * cache key and on nothing else - so the server-rendered page came from one
 * contract and every navigation after hydration came from a second one with
 * different defaults and no status checking. Sharing a key is not sharing a
 * contract.
 *
 * The one thing deliberately *not* fixed here is the transport: a loader running
 * on a server and a component running in a browser cannot reach the API the same
 * way. So {@link myFilesQueryOptions} takes a `fetchPage` and defaults it to the
 * browser's, which is the only one a shared module can assume.
 *
 * ## Hono is still the boundary
 *
 * Nothing below authorizes anything. `GET /api/@vitnode/core/users/files`
 * derives the owner from the session cookie and scopes the query to it, so a
 * request this module builds for a visitor who has just been signed out comes
 * back `401` - and {@link MyFilesRequestError} is what makes that a failed query
 * rather than an empty table.
 */

/**
 * The files module as a value the fetchers can carry without pulling the API
 * into either bundle. The module is imported as a *type* only, so route
 * literals, methods and response schemas all still infer; `clientModule`
 * supplies the one field the fetcher reads at runtime.
 */
export const userFilesModuleRef = clientModule<typeof userFilesModule>(
  CONFIG_PLUGIN.pluginId,
);

/** The module is mounted under `/users`, not at the plugin root. */
const FILES_PREFIX_PATH = "/users";

/** The columns the list route will sort by. Anything else is ignored. */
export const MY_FILES_ORDER_BY = ["createdAt", "name", "size"] as const;
export type MyFilesOrderBy = (typeof MY_FILES_ORDER_BY)[number];

export const MY_FILES_ORDER = ["asc", "desc"] as const;
export type MyFilesOrder = (typeof MY_FILES_ORDER)[number];

/**
 * The largest page the API will serve, whatever the URL asks for.
 *
 * Mirrors `MAX_PAGE_SIZE` in `@/api/lib/with-pagination`. Clamping here as well
 * as there is not redundancy: past this number the API answers `400`, and a
 * table that 400s because somebody typed `?first=5000` is a broken page rather
 * than a refused one.
 */
export const MY_FILES_MAX_PAGE_SIZE = 100;

/**
 * The list route's query, after normalisation - and therefore also the shape
 * that identifies a cache entry.
 *
 * Every field is optional and every present field is known-good: this is what
 * {@link normalizeMyFilesParams} produces and the only thing the request builder
 * and the query key accept.
 */
export interface MyFilesParams {
  cursor?: string;
  first?: string;
  last?: string;
  order?: MyFilesOrder;
  orderBy?: MyFilesOrderBy;
  search?: string;
}

/**
 * The URL as either framework hands it over, before anything has checked it.
 *
 * Values are widened to `string[]` because a query string may repeat a key and
 * both routers surface that as an array; they are widened to `null` because
 * `URLSearchParams.get` returns one. None of it is trusted - see
 * {@link normalizeMyFilesParams}.
 */
export type RawMyFilesParams = Partial<
  Record<keyof MyFilesParams, null | string | string[] | undefined>
>;

/** The first value for a key, since only one can reach the API. */
const readOne = (value: null | string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] ?? "";

  return value ?? "";
};

/**
 * A page size, or `undefined` when the URL did not ask for a usable one.
 *
 * `?first=abc`, `?first=0` and `?first=-1` are all refused by the API with a
 * `400`, so accepting them here would turn a hand-edited URL into an error
 * screen. They fall back to the default page size instead, which is the page the
 * visitor would have got had they not edited anything.
 */
const readPageSize = (raw: string): string | undefined => {
  if (!/^\d+$/.test(raw)) return undefined;

  const size = Number(raw);
  if (!Number.isSafeInteger(size) || size < 1) return undefined;

  return String(Math.min(size, MY_FILES_MAX_PAGE_SIZE));
};

/**
 * The URL's parameters, reduced to the ones this list actually has.
 *
 * Pure, and the single place a raw query string becomes a request. Both
 * frameworks call it - Next.js on `searchParams`, TanStack Start on the route's
 * validated search - so a hand-edited URL behaves identically in both, and the
 * cache key below is built from the *result* rather than from whatever was
 * typed. That last part is what makes `?first=10`, `?first=010` and no `first`
 * at all one cache entry rather than three.
 *
 * The rules, each of which exists because the alternative is a broken page:
 *
 * - **A page size is always present.** The fetcher used to lean on
 *   `withPagination`, which quietly wrote `first=10` inside the URL builder
 *   where the query key could not see it. Two requests that differed only in
 *   that invisible default shared a key.
 * - **`first` wins over `last`.** They are mutually exclusive and the API
 *   `400`s on both; the table never emits both, so a URL that has them was
 *   written by hand and forward is the direction it would have meant.
 * - **`search` is trimmed and dropped when empty.** The API trims it too and
 *   treats blank as no filter, so `?search=` and no `search` must not be two
 *   entries holding the same rows.
 * - **A cursor is shape-checked only.** It is opaque and belongs to the
 *   ordering that minted it; whether it decodes is the API's business. A value
 *   that cannot be one is dropped rather than sent, since the API answers `400`
 *   for it and the honest reading of a corrupt cursor is "start again".
 */
export const normalizeMyFilesParams = (
  raw: RawMyFilesParams = {},
): MyFilesParams => {
  const params: MyFilesParams = {};

  const cursor = readOne(raw.cursor);
  if (/^[A-Za-z0-9_-]{1,512}$/.test(cursor)) params.cursor = cursor;

  const first = readPageSize(readOne(raw.first));
  const last = readPageSize(readOne(raw.last));

  if (first !== undefined) {
    params.first = first;
  } else if (last === undefined) {
    params.first = String(DEFAULT_TABLE_PAGE_SIZE);
  } else {
    params.last = last;
  }

  const orderBy = readOne(raw.orderBy) as MyFilesOrderBy;
  if (MY_FILES_ORDER_BY.includes(orderBy)) params.orderBy = orderBy;

  const order = readOne(raw.order) as MyFilesOrder;
  if (MY_FILES_ORDER.includes(order)) params.order = order;

  const search = readOne(raw.search).trim();
  if (search) params.search = search;

  return params;
};

/**
 * One page of the list, as arguments to whichever fetcher is carrying it.
 *
 * `withPagination` is deliberately absent. That flag makes the URL builder
 * invent `first` and an empty `search` at the last possible moment, which is
 * exactly the invisible state the query key cannot include - so the defaults are
 * applied by {@link normalizeMyFilesParams} instead, in a value both the request
 * and the key are built from.
 */
export const myFilesRequest = (params: MyFilesParams) => ({
  args: { query: params },
  method: "get" as const,
  module: "files" as const,
  path: "/" as const,
  prefixPath: FILES_PREFIX_PATH,
});

/** One row of the table, as JSON delivers it. */
export interface MyFile {
  /** ISO string over the wire; a `Date` when a Next.js render passes it in. */
  createdAt: Date | string;
  dimensions: null | { height: number; width: number };
  folder: string;
  id: number;
  metadata: Record<string, unknown>;
  mimeType: null | string;
  name: string;
  size: number;
  /** `null` when no storage adapter is configured, so there is nothing to link. */
  url: null | string;
}

export interface MyFilesPage {
  edges: MyFile[];
  pageInfo: {
    count: number;
    endCursor: null | string;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: null | string;
    totalCount: number;
  };
}

/**
 * How a page is actually fetched. See {@link myFilesQueryOptions}.
 *
 * The second argument is the read's cancellation, and it is optional so the SSR
 * branch - handed no signal, deliberately - satisfies this with one parameter.
 */
export type MyFilesPageFetcher = (
  params: MyFilesParams,
  options?: { signal?: AbortSignal },
) => Promise<MyFilesPage>;

/** The `name` every {@link MyFilesRequestError} carries. See below. */
const MY_FILES_REQUEST_ERROR = "MyFilesRequestError";

/**
 * The parameters a failed request was carrying, for its message.
 *
 * Its own function because an error message is the only trace a production
 * failure leaves, and "which page was it asking for" is the first question
 * anyone reading one has.
 */
export const describeMyFilesParams = (params: MyFilesParams): string =>
  Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ") || "no filters";

/**
 * The files API refused, and this is what it refused with.
 *
 * A thrown error rather than a returned one, because the alternative is the bug
 * this class exists to prevent: the fetchers hand non-2xx responses back rather
 * than throwing on them, and `json()` would happily parse a `401` or a `429`
 * body. Read as a page it has no `edges`, so the table renders empty - a failure
 * that looks exactly like an account with nothing uploaded. TanStack Query can
 * only retry, report, or keep the last good page if the promise actually
 * rejects.
 *
 * `status` is on the error rather than folded into the message so a caller can
 * tell the finite cases apart without parsing English: `401` and `403` mean the
 * session ended or was never allowed - the route guard is a navigation rule, not
 * the boundary, so this is the *authorization* answer and it can arrive on a
 * page the guard already let through. `429` is the rate limiter. `404` and `400`
 * are a request nobody should have been able to build. A `500` never reaches
 * here at all: `rawApiFetch` throws on those with the body attached.
 *
 * Recognised by `name` rather than by `instanceof`, and that is not fussiness.
 * `@vitnode/core` is imported from `dist` by the apps and from `src` by its own
 * tests, so two copies of this class can exist in one process and `instanceof`
 * would answer `false` across them.
 */
export class MyFilesRequestError extends Error {
  constructor(status: number, params: MyFilesParams) {
    super(
      `The files API answered ${status} for the current user's files (${describeMyFilesParams(params)}).`,
    );
    this.name = MY_FILES_REQUEST_ERROR;
    this.params = params;
    this.status = status;
  }
  readonly params: MyFilesParams;

  readonly status: number;
}

export const isMyFilesRequestError = (
  error: unknown,
): error is MyFilesRequestError =>
  error instanceof Error && error.name === MY_FILES_REQUEST_ERROR;

/**
 * One page, fetched from the browser.
 *
 * `fetcherClient` builds the same same-origin `/api/@vitnode/core/users/files`
 * URL every other VitNode client call uses, so the browser attaches the session
 * cookie itself and a `429` is routed to the global rate-limit notice on the way
 * through.
 */
export const fetchMyFilesPageInBrowser: MyFilesPageFetcher = async (
  params,
  { signal } = {},
) => {
  const response = await fetcherClient(userFilesModuleRef, {
    ...myFilesRequest(params),
    options: { signal },
  });

  if (!response.ok) throw new MyFilesRequestError(response.status, params);

  return await response.json();
};

/**
 * Every visitor's files, as one prefix above the per-owner partitions.
 *
 * {@link myFilesQueryRoot} narrows this to one owner and is what a *mutation*
 * invalidates. This is the wider one, and it has exactly one caller: the public
 * identity cleanup in `tanstack/auth/queries`, which runs when the person at the
 * keyboard may have changed and therefore cannot name whose partition to drop -
 * the point is that *no* previous visitor's rows stay in the browser, and the
 * one being signed out is not necessarily the only one in there.
 *
 * Partitioning already stops B *reading* A's entry (see below). This is the
 * other half, and it is the half the AdminCP has had since Stage 12: an entry
 * nobody can read is still a copy of A's file names, folders and sizes sitting
 * in the heap of a browser A has walked away from, for `gcTime` after they left.
 * The two halves of the app should not disagree about whether that is acceptable.
 *
 * Written as its own constant rather than sliced off a key at the call site so
 * that the prefix and the keys it must match are one edit: a partition scheme
 * that changed here without changing {@link myFilesQueryRoot} would leave a
 * cleanup that quietly collects nothing.
 */
export const MY_FILES_IDENTITY_ROOT = ["files", "user"] as const;

/**
 * The root every cache entry for one visitor's files hangs off.
 *
 * A factory over the owner's id rather than the constant `["files", "me"]` it
 * replaces, and the difference is a privacy one rather than a tidiness one.
 *
 * ## Why `"me"` was unsafe
 *
 * `"me"` is only stable for as long as "me" is. The browser's `QueryClient` is
 * created once per document and outlives a sign-out, so one browser can hold two
 * visitors in one session:
 *
 *     A signs in  -> /files      -> ["files","me",params] holds A's file names
 *     A signs out
 *     B signs in  -> /files      -> the loader asks for ["files","me",params]
 *
 * and that entry is already populated. With `refetchOnMount` and
 * `refetchOnWindowFocus` both off in VitNode's client defaults, nothing would
 * have refetched it, so B would read A's private data with no API request made
 * at all - which is exactly why Hono cannot defend against it. There is no
 * request for it to authorize.
 *
 * Keyed by owner the two visitors address different entries, B's is empty, the
 * fetch happens, and the API answers it from B's own session cookie.
 *
 * ## The id is a cache address, never a claim
 *
 * Nothing about this reaches the network. {@link myFilesRequest} takes no owner
 * and `GET /users/files` derives it from the session cookie, exactly as before -
 * so a tampered id partitions a cache differently and authorizes nothing. Were
 * it ever sent, this would stop being a cache key and become an access-control
 * parameter, which is the one thing it must not be.
 */
export const myFilesQueryRoot = (userId: number) =>
  [...MY_FILES_IDENTITY_ROOT, userId] as const;

/**
 * The cache entry one page of one visitor's list reads and writes.
 *
 * The owner, then the normalised parameters. Everything that changes which rows
 * come back is in there - page, size, sort, search - and nothing that does not.
 *
 * The locale is deliberately absent. File names, folders, sizes and metadata are
 * the visitor's own data and identical in every language; the only translated
 * things on the page are the column headings, which the renderer resolves. Two
 * entries holding identical rows would mean a language switch silently refetched
 * a list that had not changed.
 *
 * An object in a key is safe - Query hashes keys structurally rather than by
 * identity - which is exactly why the object has to be the *normalised* one.
 */
export const myFilesQueryKey = ({
  params,
  userId,
}: {
  params: MyFilesParams;
  userId: number;
}) => [...myFilesQueryRoot(userId), params] as const;

/**
 * The visitor's files, as the one query definition every caller shares.
 *
 * A route loader warms it before the component renders:
 *
 *     context.queryClient.ensureQueryData(
 *       myFilesQueryOptions({ params, userId }),
 *     )
 *
 * and the component reads the very same options back:
 *
 *     const { data } = useQuery(myFilesQueryOptions({ params, userId }))
 *
 * Same key, same request, same status checking - so the loader's page is the
 * page the component renders, and a delete that invalidates
 * {@link myFilesQueryRoot} refetches through the identical contract.
 *
 * `userId` addresses the cache and nothing else - see {@link myFilesQueryRoot}.
 * It is required rather than defaulted because there is no honest default: a
 * fallback would be one shared entry again, which is the bug the parameter
 * exists to close. Both callers take it from the one place that knows it, the
 * `_authenticated` route context, so the loader and the component cannot drift
 * onto two different partitions.
 *
 * `fetchPage` is the seam. It defaults to the browser's fetcher, which is what a
 * hydrated page wants; an app that also fetches during SSR passes one that can
 * do both. It is a plain async function rather than anything framework-shaped,
 * so nothing about this module knows which framework is rendering it.
 *
 * ## It asks once
 *
 * `retry: false`, against Query's default of three attempts. Every failure this
 * read can produce is made worse by repeating it: a `429` is answered by sending
 * the same request two more times, which is the thing the limiter is asking this
 * app to stop doing, and a `401` is not going to become a `200` because we asked
 * again. A page that has genuinely gone wrong should say so on the first
 * attempt, and the visitor retries by reloading - a decision they can make and a
 * rate limiter can see coming.
 *
 * No `staleTime`. Freshness is whatever the API's own caching gives, plus
 * VitNode's client defaults (`refetchOnMount` and `refetchOnWindowFocus` both
 * off), so a hydrated table is not refetched behind the reader; a delete is what
 * makes it stale, explicitly.
 *
 * ## And it can be given up on
 *
 * The `queryFn` **reads** `signal` off the context, which is the only thing that
 * marks a query cancellable. Paging through a large library leaves one request
 * in flight rather than one per press, and the abandoned ones reject rather than
 * landing late on top of the page being read.
 *
 * Safe because the fetcher throws: the abort rejects inside `fetch`, so it can
 * never arrive as `MyFilesRequestError` (a refusal), as an empty page (an
 * account with nothing uploaded) or as a `401` (a session that ended).
 */
export const myFilesQueryOptions = ({
  fetchPage = fetchMyFilesPageInBrowser,
  params,
  userId,
}: {
  fetchPage?: MyFilesPageFetcher;
  params: MyFilesParams;
  userId: number;
}) =>
  queryOptions({
    // `userId` is deliberately absent from the request: the owner comes from
    // the session cookie, on the server, on every call.
    queryFn: async ({ signal }) => await fetchPage(params, { signal }),
    queryKey: myFilesQueryKey({ params, userId }),
    retry: false,
    /** {@link RECORD_STALE_TIME} - A delete here invalidates immediately; this catches one performed on another device. */
    staleTime: RECORD_STALE_TIME,
  });

/**
 * What {@link MyFilesTableContent} accepts, and the reason it accepts only this.
 *
 * Typed as the factory's own return type on purpose: a caller cannot hand the
 * table a hand-rolled options object that happens to type-check, so "one query
 * definition" is enforced by the compiler rather than by review.
 */
export type MyFilesQueryOptions = ReturnType<typeof myFilesQueryOptions>;
