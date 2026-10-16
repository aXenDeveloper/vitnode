import type { CronParams } from "@/views/admin/views/core/advanced/cron/cron-query";
import type {
  DebugLogsOrderBy,
  DebugLogsParams,
} from "@/views/admin/views/core/debug/debug-query";

import { DEBUG_LOGS_TABLE_CONTRACT } from "@/views/admin/views/core/debug/debug-query";

import type { CronRouteSearch } from "../cron/route-search";
import type {
  AdminTableRouteSearch,
  UncheckedAdminTableSearch,
} from "../table-search";

import { cronRouteParams } from "../cron/route-search";
import {
  adminTableRouteParams,
  adminTableSearchFrom,
  adminTableSearchParams,
  normalizeAdminTableSearch,
} from "../table-search";

export const DEBUG_TABS = [
  "overview",
  "vitnode",
  "plugins",
  "cron",
  "cache",
  "search",
  "services",
  "logs",
  "queue",
  "ai",
] as const;

export type DebugTab = (typeof DEBUG_TABS)[number];

export const DEBUG_PATH = "/admin/core/debug";

export const debugTabPath = (tab: DebugTab): string =>
  tab === "overview" ? DEBUG_PATH : `${DEBUG_PATH}/${tab}`;

export const debugTabFromPath = (pathname: string): DebugTab => {
  const segment = pathname.slice(DEBUG_PATH.length).split("/")[1];

  return (
    DEBUG_TABS.find(tab => tab !== "overview" && tab === segment) ?? "overview"
  );
};

export const debugCronParams = (input: CronRouteSearch): CronParams => {
  const params = cronRouteParams(input);

  return params.orderBy
    ? params
    : { ...params, order: "asc", orderBy: "nextRun" };
};

export type DebugLogsRouteSearch = AdminTableRouteSearch<DebugLogsOrderBy>;

export const debugLogsRouteParams = (
  input: UncheckedAdminTableSearch<DebugLogsOrderBy>,
): DebugLogsParams => adminTableRouteParams(input, DEBUG_LOGS_TABLE_CONTRACT);

export const normalizeDebugLogsSearch = (
  input: UncheckedAdminTableSearch<DebugLogsOrderBy>,
): DebugLogsRouteSearch =>
  normalizeAdminTableSearch(input, DEBUG_LOGS_TABLE_CONTRACT);

export const debugLogsSearchParams = (
  input: UncheckedAdminTableSearch<DebugLogsOrderBy>,
): URLSearchParams => adminTableSearchParams(input, DEBUG_LOGS_TABLE_CONTRACT);

export const debugLogsSearchFrom = (nextSearch: string): DebugLogsRouteSearch =>
  adminTableSearchFrom(nextSearch, DEBUG_LOGS_TABLE_CONTRACT);
