import { queryOptions } from "@tanstack/react-query";

import type { userFilesModule } from "@/api/modules/users/files/files.module";
import type { UniversalFetcher } from "@/lib/fetcher-client";

import { DEFAULT_TABLE_PAGE_SIZE } from "@/components/table/url-state";
import { CONFIG_PLUGIN } from "@/config";
import { clientModule, fetcherClient } from "@/lib/fetcher-client";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";

export const userFilesModuleRef = clientModule<typeof userFilesModule>(
  CONFIG_PLUGIN.pluginId,
);

/** The module is mounted under `/users`, not at the plugin root. */
export const FILES_PREFIX_PATH = "/users";

/** The columns the list route will sort by. Anything else is ignored. */
export const MY_FILES_ORDER_BY = ["createdAt", "name", "size"] as const;
export type MyFilesOrderBy = (typeof MY_FILES_ORDER_BY)[number];

export const MY_FILES_ORDER = ["asc", "desc"] as const;
export type MyFilesOrder = (typeof MY_FILES_ORDER)[number];

export const MY_FILES_MAX_PAGE_SIZE = 100;

export interface MyFilesParams {
  cursor?: string;
  first?: string;
  last?: string;
  order?: MyFilesOrder;
  orderBy?: MyFilesOrderBy;
  search?: string;
}

export type RawMyFilesParams = Partial<
  Record<keyof MyFilesParams, null | string | string[] | undefined>
>;

/** The first value for a key, since only one can reach the API. */
const readOne = (value: null | string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] ?? "";

  return value ?? "";
};

const readPageSize = (raw: string): string | undefined => {
  if (!/^\d+$/.test(raw)) return undefined;

  const size = Number(raw);
  if (!Number.isSafeInteger(size) || size < 1) return undefined;

  return String(Math.min(size, MY_FILES_MAX_PAGE_SIZE));
};

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

export type MyFilesPageFetcher = (
  params: MyFilesParams,
  options?: { signal?: AbortSignal },
) => Promise<MyFilesPage>;

/** The `name` every {@link MyFilesRequestError} carries. See below. */
const MY_FILES_REQUEST_ERROR = "MyFilesRequestError";

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

export const myFilesPageFetcher =
  (transport: UniversalFetcher): MyFilesPageFetcher =>
  async (params, { signal } = {}) => {
    const response = await transport(userFilesModuleRef, {
      args: { query: params },
      method: "get",
      module: "files",
      options: { signal },
      path: "/",
      prefixPath: FILES_PREFIX_PATH,
    });

    if (!response.ok) throw new MyFilesRequestError(response.status, params);

    return await response.json();
  };

export const fetchMyFilesPageInBrowser: MyFilesPageFetcher =
  myFilesPageFetcher(fetcherClient);

export const MY_FILES_IDENTITY_ROOT = ["files", "user"] as const;

export const myFilesQueryRoot = (userId: number) =>
  [...MY_FILES_IDENTITY_ROOT, userId] as const;

export const myFilesQueryKey = ({
  params,
  userId,
}: {
  params: MyFilesParams;
  userId: number;
}) => [...myFilesQueryRoot(userId), params] as const;

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

export type MyFilesQueryOptions = ReturnType<typeof myFilesQueryOptions>;
