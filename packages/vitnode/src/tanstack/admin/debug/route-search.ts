import type {
  DebugLogsOrderBy,
  DebugLogsParams,
} from "@/views/admin/views/core/debug/debug-query";

import { DEBUG_LOGS_TABLE_CONTRACT } from "@/views/admin/views/core/debug/debug-query";

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

/**
 * The debug panel's URL contract - the shared admin-table one, applied to the
 * system log.
 *
 * The log table is the only thing on this screen with URL state: the queue
 * snapshot has no pager and no sort, and the clear-cache button writes nothing.
 * So the screen's search *is* the log table's.
 */

export type DebugRouteSearch = AdminTableRouteSearch<DebugLogsOrderBy>;
export type UncheckedDebugSearch = UncheckedAdminTableSearch<DebugLogsOrderBy>;

/** The request this URL is asking for, and therefore the query key. */
export const debugLogsRouteParams = (
  input: UncheckedDebugSearch,
): DebugLogsParams => adminTableRouteParams(input, DEBUG_LOGS_TABLE_CONTRACT);

/** The route's `validateSearch`: it normalises rather than rejects. */
export const normalizeDebugRouteSearch = (
  input: UncheckedDebugSearch,
): DebugRouteSearch =>
  normalizeAdminTableSearch(input, DEBUG_LOGS_TABLE_CONTRACT);

/** The query string the log table's controls read themselves out of. */
export const debugSearchParams = (
  input: UncheckedDebugSearch,
): URLSearchParams => adminTableSearchParams(input, DEBUG_LOGS_TABLE_CONTRACT);

/** A query string one of those controls produced, back as route search. */
export const debugSearchFrom = (nextSearch: string): DebugRouteSearch =>
  adminTableSearchFrom(nextSearch, DEBUG_LOGS_TABLE_CONTRACT);
