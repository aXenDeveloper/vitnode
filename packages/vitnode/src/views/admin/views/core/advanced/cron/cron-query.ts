import { queryOptions } from "@tanstack/react-query";

import type { cronAdminModule } from "@/api/modules/admin/advanced/cron/cron.admin.module";
import type {
  AdminTableContract,
  AdminTablePage,
  AdminTableParams,
} from "@/views/admin/table/params";

import { fetcherClient } from "@/lib/fetcher-client";
import { OPERATIONAL_STALE_TIME } from "@/lib/query-freshness";
import {
  adminModuleRef,
  AdminRequestError,
  describeAdminParams,
} from "@/views/admin/admin-request";
import { adminQueryRoot } from "@/views/admin/table/query";

/**
 * The AdminCP cron list, as one query definition.
 *
 * Everything about *what* the list is - the request, which columns it sorts by,
 * the cache entry it lands in, and what counts as a refusal - lives here and
 * nowhere else. The Next.js Server Component and the TanStack Start loader both
 * read through it, so `?orderBy=lastRun` is one request rather than two that
 * happen to look alike.
 *
 * The transport is deliberately *not* fixed: a loader running on a server and a
 * component running in a browser cannot reach the API the same way, so
 * {@link cronQueryOptions} takes a `fetchPage` and defaults it to the browser's -
 * the only one a shared module can assume.
 *
 * Hono is still the boundary. `GET /api/@vitnode/core/admin/advanced/cron`
 * declares `adminStaffPermission: { module: "cron", permission: "can_view" }`,
 * re-checked against the staff tables on every request, so nothing below
 * authorizes anything.
 */

export const cronAdminModuleRef = adminModuleRef<typeof cronAdminModule>();

/** The module is mounted under `/admin/advanced`, not at the plugin root. */
export const CRON_PREFIX_PATH = "/admin/advanced";

/**
 * The columns this list sorts by - the `orderBy` enum on `getCronsRoute`,
 * restated on the frontend so an unrecognised value is dropped here instead of
 * being answered with a `400`.
 */
export const CRON_ORDER_BY = ["createdAt", "lastRun", "nextRun"] as const;
export type CronOrderBy = (typeof CRON_ORDER_BY)[number];

/** The cron table's URL contract: sortable columns, no search, no filter. */
export const CRON_TABLE_CONTRACT: AdminTableContract<CronOrderBy> = {
  orderBy: CRON_ORDER_BY,
};

export type CronParams = AdminTableParams<CronOrderBy>;

/**
 * One page of the list, as arguments to whichever fetcher is carrying it.
 *
 * `withPagination` is deliberately absent - see `views/admin/table/params.ts`
 * for why an invisible default is a cache-key bug rather than a convenience.
 */
/**
 * One row of the table, as JSON delivers it.
 *
 * Declared rather than inferred off the fetcher, because the inferred type
 * cannot be named across a declaration-emit boundary. It stays honest anyway:
 * {@link fetchCronPageInBrowser} is typed as {@link CronPageFetcher} and returns
 * the response's own inferred shape, so a column renamed in `getCronsRoute`
 * stops this file compiling rather than rendering `undefined`.
 *
 * `createdAt`, `lastRun` and `nextRun` are `Date | string` for the same reason
 * `MyFile` is: the schema says `z.date()`, and JSON delivers an ISO string.
 */
export interface CronJobRow {
  createdAt: Date | string;
  description: null | string;
  id: number;
  lastRun: Date | null | string;
  module: string;
  name: string;
  nextRun: Date | null | string;
  pluginId: string;
  schedule: string;
}

/** One page of the list, exactly as the route's `200` schema declares it. */
export type CronPage = AdminTablePage<CronJobRow>;

/** How a page is actually fetched. See {@link cronQueryOptions}. */
export type CronPageFetcher = (params: CronParams) => Promise<CronPage>;

/**
 * One page, fetched from the browser.
 *
 * `fetcherClient` builds the same same-origin URL every other VitNode client
 * call uses, so the browser attaches the admin cookie itself and a `429` is
 * routed to the global rate-limit notice on the way through.
 */
export const fetchCronPageInBrowser: CronPageFetcher = async params => {
  const response = await fetcherClient(cronAdminModuleRef, {
    args: { query: params },
    method: "get",
    module: "cron",
    path: "/",
    prefixPath: CRON_PREFIX_PATH,
  });

  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      "the cron list",
      describeAdminParams(params),
    );
  }

  return await response.json();
};

/** The root every cached page of the cron list hangs off. */
export const cronQueryRoot = adminQueryRoot("cron");

/**
 * The cache entry one page of the list reads and writes.
 *
 * The normalised parameters, and nothing else: everything that changes which
 * rows come back is in there - page, size, sort - and nothing that does not. The
 * locale is absent on purpose, because a cron job's name, schedule and run times
 * are identical in every language; only the column headings are translated, and
 * the renderer resolves those.
 *
 * An object in a key is safe - Query hashes keys structurally - which is exactly
 * why the object has to be the *normalised* one.
 */
export const cronQueryKey = (params: CronParams) =>
  [...cronQueryRoot, params] as const;

/**
 * The cron list, as the one query definition every caller shares.
 *
 *     loader:     ensureQueryData(cronQueryOptions({ fetchPage, params }))
 *     component:  useSuspenseQuery(cronQueryOptions({ params }))
 *     after a run: invalidate `cronQueryRoot`, and it refetches
 *
 * `retry: false`, against Query's default of three attempts: every failure this
 * read can produce is made worse by repeating it. A `429` is answered by sending
 * the same request twice more, and a `403` is not going to become a `200`
 * because we asked again.
 */
export const cronQueryOptions = ({
  fetchPage = fetchCronPageInBrowser,
  params,
}: {
  fetchPage?: CronPageFetcher;
  params: CronParams;
}) =>
  queryOptions({
    queryFn: async () => await fetchPage(params),
    queryKey: cronQueryKey(params),
    retry: false,
    /** {@link OPERATIONAL_STALE_TIME} - A cron job's next run and last result move without anybody pressing anything. */
    staleTime: OPERATIONAL_STALE_TIME,
  });
