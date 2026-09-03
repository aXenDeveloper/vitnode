import type {
  CronOrderBy,
  CronParams,
} from "@/views/admin/views/core/advanced/cron/cron-query";

import { CRON_TABLE_CONTRACT } from "@/views/admin/views/core/advanced/cron/cron-query";

import type {
  AdminTableRouteSearch,
  UncheckedAdminTableSearch,
} from "../table-search";

import {
  adminTableRouteParams,
  adminTableSearchFrom,
  adminTableSearchParams,
  normalizeAdminTableSearch,
} from "../table-search";

export type CronRouteSearch = AdminTableRouteSearch<CronOrderBy>;
export type UncheckedCronSearch = UncheckedAdminTableSearch<CronOrderBy>;

/** The request this URL is asking for, and therefore the query key. */
export const cronRouteParams = (input: UncheckedCronSearch): CronParams =>
  adminTableRouteParams(input, CRON_TABLE_CONTRACT);

/** The route's `validateSearch`: it normalises rather than rejects. */
export const normalizeCronRouteSearch = (
  input: UncheckedCronSearch,
): CronRouteSearch => normalizeAdminTableSearch(input, CRON_TABLE_CONTRACT);

/** The query string the table's controls read themselves out of. */
export const cronSearchParams = (input: UncheckedCronSearch): URLSearchParams =>
  adminTableSearchParams(input, CRON_TABLE_CONTRACT);

/** A query string one of those controls produced, back as route search. */
export const cronSearchFrom = (nextSearch: string): CronRouteSearch =>
  adminTableSearchFrom(nextSearch, CRON_TABLE_CONTRACT);
