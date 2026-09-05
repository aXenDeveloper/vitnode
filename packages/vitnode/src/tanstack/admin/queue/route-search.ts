import type {
  QueueOrderBy,
  QueueParams,
} from "@/views/admin/views/core/advanced/queue/queue-query";

import { QUEUE_TABLE_CONTRACT } from "@/views/admin/views/core/advanced/queue/queue-query";

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

export type QueueRouteSearch = AdminTableRouteSearch<QueueOrderBy>;
export type UncheckedQueueSearch = UncheckedAdminTableSearch<QueueOrderBy>;

/** The request this URL is asking for, and therefore the query key. */
export const queueRouteParams = (input: UncheckedQueueSearch): QueueParams =>
  adminTableRouteParams(input, QUEUE_TABLE_CONTRACT);

/** The route's `validateSearch`: it normalises rather than rejects. */
export const normalizeQueueRouteSearch = (
  input: UncheckedQueueSearch,
): QueueRouteSearch => normalizeAdminTableSearch(input, QUEUE_TABLE_CONTRACT);

/** The query string the table's controls read themselves out of. */
export const queueSearchParams = (
  input: UncheckedQueueSearch,
): URLSearchParams => adminTableSearchParams(input, QUEUE_TABLE_CONTRACT);

/** A query string one of those controls produced, back as route search. */
export const queueSearchFrom = (nextSearch: string): QueueRouteSearch =>
  adminTableSearchFrom(nextSearch, QUEUE_TABLE_CONTRACT);
