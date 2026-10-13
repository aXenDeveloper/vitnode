import type { QueryClient } from "@tanstack/react-query";

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { CONFIG_PLUGIN } from "@/config";
import { fetcher } from "@/tanstack/fetcher";

export interface ModcpReportsFilter {
  assigned: "any" | "me" | "unassigned";
  page: number;
  pageSize: number;
  search?: string;
  status: "all" | "done" | "in_progress" | "new" | "open";
}

export const MODCP_BOARD_STATUSES = ["new", "in_progress", "done"] as const;

export type ModcpBoardStatus = (typeof MODCP_BOARD_STATUSES)[number];

export interface ModcpBoardFilter {
  assigned: "any" | "me" | "unassigned";
  search?: string;
}

export const MODCP_BOARD_PAGE_SIZE = 20;

export class ModcpRequestError extends Error {
  constructor(status: number, what: string) {
    super(`Reading ${what} answered ${status}.`);
    this.status = status;
  }

  readonly status: number;
}

const MODCP_ROOT = ["vitnode", "moderation"] as const;

const fetchReports = async (filter: ModcpReportsFilter) => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { query: filter },
    method: "get",
    module: "moderation",
    path: "/reports",
  });
  if (!response.ok) throw new ModcpRequestError(response.status, "reports");

  return await response.json();
};

export type ModcpReportsPage = Awaited<ReturnType<typeof fetchReports>>;

export type ModcpBoardReport = ModcpReportsPage["items"][number];

export const modcpReportsQueryOptions = (filter: ModcpReportsFilter) =>
  queryOptions({
    queryFn: async () => await fetchReports(filter),
    queryKey: [...MODCP_ROOT, "reports", filter],
    retry: false,
    staleTime: 10_000,
  });

export const modcpBoardColumnQueryOptions = (
  status: ModcpBoardStatus,
  filter: ModcpBoardFilter,
) =>
  infiniteQueryOptions({
    getNextPageParam: (last: ModcpReportsPage) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      await fetchReports({
        ...filter,
        page: pageParam,
        pageSize: MODCP_BOARD_PAGE_SIZE,
        status,
      }),
    queryKey: [...MODCP_ROOT, "board", status, filter],
    retry: false,
    staleTime: 10_000,
  });

const fetchReport = async (id: number) => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { params: { id } },
    method: "get",
    module: "moderation",
    path: "/reports/{id}",
  });
  if (!response.ok) throw new ModcpRequestError(response.status, "a report");

  return await response.json();
};

export type ModcpReportDetail = Awaited<ReturnType<typeof fetchReport>>;

export const modcpReportQueryOptions = (id: number) =>
  queryOptions({
    queryFn: async () => await fetchReport(id),
    queryKey: [...MODCP_ROOT, "report", id],
    retry: false,
    staleTime: 0,
  });

const fetchAssignees = async (id: number) => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { params: { id } },
    method: "get",
    module: "moderation",
    path: "/reports/{id}/assignees",
  });
  if (!response.ok) return [];

  return await response.json();
};

export const modcpAssigneesQueryOptions = (id: number) =>
  queryOptions({
    queryFn: async () => await fetchAssignees(id),
    queryKey: [...MODCP_ROOT, "report", id, "assignees"],
    retry: false,
    staleTime: 30_000,
  });

export const invalidateModcp = async (queryClient: QueryClient) =>
  await queryClient.invalidateQueries({ queryKey: MODCP_ROOT });
