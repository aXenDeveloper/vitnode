import { queryOptions } from "@tanstack/react-query";

import type { cronAdminModule } from "@/api/modules/admin/advanced/cron/cron.admin.module";
import type { UniversalFetcher } from "@/lib/fetcher-client";
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

export const cronAdminModuleRef = adminModuleRef<typeof cronAdminModule>();

/** The module is mounted under `/admin/advanced`, not at the plugin root. */
export const CRON_PREFIX_PATH = "/admin/advanced";

export const CRON_ORDER_BY = ["createdAt", "lastRun", "nextRun"] as const;
export type CronOrderBy = (typeof CRON_ORDER_BY)[number];

/** The cron table's URL contract: sortable columns, no search, no filter. */
export const CRON_TABLE_CONTRACT: AdminTableContract<CronOrderBy> = {
  orderBy: CRON_ORDER_BY,
};

export type CronParams = AdminTableParams<CronOrderBy>;

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

export const cronPageFetcher =
  (transport: UniversalFetcher): CronPageFetcher =>
  async params => {
    const response = await transport(cronAdminModuleRef, {
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

export const fetchCronPageInBrowser: CronPageFetcher =
  cronPageFetcher(fetcherClient);

/** The root every cached page of the cron list hangs off. */
export const cronQueryRoot = adminQueryRoot("cron");

export const cronQueryKey = (params: CronParams) =>
  [...cronQueryRoot, params] as const;

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
