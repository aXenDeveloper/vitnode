import type {
  NotificationsTableOrderBy,
  NotificationsTableParams,
  NotificationsTableStatus,
} from "@/views/notifications/notifications-query";

import { DEFAULT_TABLE_PAGE_SIZE } from "@/components/table/url-state";
import { asSearchValue } from "@/lib/table-params";
import { normalizeNotificationsTableParams } from "@/views/notifications/notifications-query";

const DEFAULT_PAGE_SIZE = String(DEFAULT_TABLE_PAGE_SIZE);

export interface NotificationsRouteSearch {
  category?: string;
  first?: number;
  order?: "asc" | "desc";
  orderBy?: NotificationsTableOrderBy;
  page?: number;
  status?: NotificationsTableStatus;
}

export type UncheckedNotificationsSearch =
  | NotificationsRouteSearch
  | Record<string, unknown>;

export const notificationsRouteParams = (
  input: UncheckedNotificationsSearch,
): NotificationsTableParams =>
  normalizeNotificationsTableParams({
    category: asSearchValue(input.category),
    first: asSearchValue(input.first),
    order: asSearchValue(input.order),
    orderBy: asSearchValue(input.orderBy),
    page: asSearchValue(input.page),
    status:
      asSearchValue(input.status) ??
      ("filter" in input && input.filter === "unread" ? "unread" : undefined),
  });

export const normalizeNotificationsRouteSearch = (
  input: UncheckedNotificationsSearch,
): NotificationsRouteSearch => {
  const { category, first, order, orderBy, page, status } =
    notificationsRouteParams(input);

  return {
    ...(page === undefined ? {} : { page: Number(page) }),
    ...(first === undefined || first === DEFAULT_PAGE_SIZE
      ? {}
      : { first: Number(first) }),
    ...(order === undefined ? {} : { order }),
    ...(orderBy === undefined ? {} : { orderBy }),
    ...(status === undefined ? {} : { status }),
    ...(category === undefined ? {} : { category }),
  };
};

export const notificationsSearchParams = (
  input: UncheckedNotificationsSearch,
): URLSearchParams => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(
    normalizeNotificationsRouteSearch(input),
  )) {
    params.set(key, String(value));
  }

  return params;
};

export const notificationsSearchFrom = (
  nextSearch: string,
): NotificationsRouteSearch =>
  normalizeNotificationsRouteSearch(
    Object.fromEntries(new URLSearchParams(nextSearch)),
  );
