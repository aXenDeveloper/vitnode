import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
} from "@tanstack/react-query";

import type { AuditArea, AuditStaffLog } from "@/lib/audit/const";

import { fetcherClient } from "@/lib/fetcher-client";
import { OPERATIONAL_STALE_TIME } from "@/lib/query-freshness";
import { manifest } from "@/manifest";
import { fetcher } from "@/tanstack/fetcher";

/** The filters an Activity Logs list is read with, as they sit in the URL. */
export interface ActivityFilters {
  action?: string;
  actorId?: number;
  area?: AuditArea;
  from?: string;
  pluginId?: string;
  search?: string;
  targetId?: string;
  targetType?: string;
  to?: string;
}

export class ActivityRequestError extends Error {
  constructor(status: number, what: string) {
    super(`Reading ${what} answered ${status}.`);
    this.name = "ActivityRequestError";
    this.status = status;
  }

  readonly status: number;
}

/** Every cached Activity Logs read - invalidate it after a write. */
export const ACTIVITY_QUERY_ROOT = ["vitnode", "activity-logs"] as const;

const nextCursor = (last: {
  pageInfo: { endCursor: null | string; hasNextPage: boolean };
}) =>
  last.pageInfo.hasNextPage
    ? (last.pageInfo.endCursor ?? undefined)
    : undefined;

/** The filters of one staff log, as the API reads them. */
export type ActivityStaffFilters = ActivityFilters & { staff: AuditStaffLog };

const fetchPage = async (filters: ActivityStaffFilters, cursor?: string) => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { query: { ...filters, ...(cursor ? { cursor } : {}) } },
    method: "get",
    module: "admin/activity-logs",
    path: "/",
  });
  if (!response.ok) {
    throw new ActivityRequestError(response.status, "the activity log");
  }

  return await response.json();
};

export type ActivityPage = Awaited<ReturnType<typeof fetchPage>>;

export type ActivityEntry = ActivityPage["edges"][number];

/**
 * The list, page by page: a keyset cursor newest-first, so "Load more" is as
 * cheap on the hundredth page as on the first. Keyed on the filters, and keeps
 * the previous result on screen while a new filter loads.
 */
export const activityListQueryOptions = (filters: ActivityStaffFilters) =>
  infiniteQueryOptions({
    getNextPageParam: nextCursor,
    initialPageParam: undefined as string | undefined,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }) => await fetchPage(filters, pageParam),
    queryKey: [...ACTIVITY_QUERY_ROOT, "list", filters],
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });

const fetchDetail = async (id: number) => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { params: { id } },
    method: "get",
    module: "admin/activity-logs",
    path: "/{id}",
  });
  if (!response.ok) {
    throw new ActivityRequestError(response.status, "an activity entry");
  }

  return await response.json();
};

export type ActivityDetail = Awaited<ReturnType<typeof fetchDetail>>;

export const activityDetailQueryOptions = (id: number) =>
  queryOptions({
    queryFn: async () => await fetchDetail(id),
    queryKey: [...ACTIVITY_QUERY_ROOT, "detail", id],
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });

const fetchFilterOptions = async () => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "admin/activity-logs",
    path: "/filters",
  });
  if (!response.ok) {
    throw new ActivityRequestError(response.status, "activity filters");
  }

  return await response.json();
};

export type ActivityFilterOptions = Awaited<
  ReturnType<typeof fetchFilterOptions>
>;

/** The plugins and actions the filters offer. Changes only with a deploy. */
export const activityFilterOptionsQueryOptions = () =>
  queryOptions({
    queryFn: fetchFilterOptions,
    queryKey: [...ACTIVITY_QUERY_ROOT, "filters"],
    retry: false,
    staleTime: Infinity,
  });

const fetchEntityPage = async (
  target: { pluginId: string; targetId: string; targetType: string },
  cursor?: string,
) => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { query: { ...target, ...(cursor ? { cursor } : {}) } },
    method: "get",
    module: "admin/activity-logs",
    path: "/entity",
  });
  if (!response.ok) {
    throw new ActivityRequestError(response.status, "an entity's activity");
  }

  return await response.json();
};

export type ActivityEntityPage = Awaited<ReturnType<typeof fetchEntityPage>>;

export type ActivityEntityEntry = ActivityEntityPage["edges"][number];

/** One resource's history, newest first - see `ActivityHistory`. */
export const activityEntityQueryOptions = (target: {
  pluginId: string;
  targetId: string;
  targetType: string;
}) =>
  infiniteQueryOptions({
    getNextPageParam: nextCursor,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => await fetchEntityPage(target, pageParam),
    queryKey: [...ACTIVITY_QUERY_ROOT, "entity", target],
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });

const fetchSettings = async () => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "admin/activity-logs",
    path: "/settings",
  });
  if (!response.ok) {
    throw new ActivityRequestError(response.status, "activity settings");
  }

  return await response.json();
};

export const activitySettingsQueryOptions = () =>
  queryOptions({
    queryFn: fetchSettings,
    queryKey: [...ACTIVITY_QUERY_ROOT, "settings"],
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });

/** Saves the retention period; the caller invalidates and toasts. */
export const saveActivitySettings = async (retentionDays: number) => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { body: { retentionDays } },
    method: "put",
    module: "admin/activity-logs",
    path: "/settings",
  });
  if (!response.ok) {
    throw new ActivityRequestError(response.status, "activity settings");
  }

  return await response.json();
};

/**
 * Downloads the CSV export of the current filters - the existing download
 * pattern: fetched with the AdminCP session, saved through an object URL. The
 * API checks `can_export` and leaves IP addresses out without
 * `can_view_sensitive`. Browser-only.
 */
export const downloadActivityExport = async (
  filters: ActivityStaffFilters,
): Promise<void> => {
  const response = await fetcherClient({
    plugin: manifest.id,
    args: { query: filters },
    method: "get",
    module: "admin/activity-logs",
    options: { credentials: "include" },
    path: "/export",
  });
  if (!response.ok) {
    throw new ActivityRequestError(response.status, "the activity export");
  }

  const objectUrl = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `${filters.staff}-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
};
