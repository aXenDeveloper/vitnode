import type { QueryClient } from "@tanstack/react-query";

import type { AccountStatusHistoryParams } from "@/views/moderation/warnings/warnings-api";

import { asSearchValue, readPageSize } from "@/lib/table-params";
import {
  accountStatusHistoryQueryOptions,
  accountStatusQueryOptions,
} from "@/views/moderation/warnings/warnings-api";

import { SETTINGS_NAMESPACES } from "../settings/route";

export const STANDING_NAMESPACES = [
  ...SETTINGS_NAMESPACES,
  "core.moderation",
] as const;

export const STANDING_PAGE_SIZE = 10;
const MAX_PAGE = 10_000;
const KINDS = ["warning", "suspension"] as const;
const STATUSES = ["active", "expired", "revoked", "lifted", "ended"] as const;

export interface StandingRouteSearch {
  first?: number;
  order?: "asc";
  orderBy?: "points";
  page?: number;
  search?: string;
  status?: string;
  type?: string;
}

const positiveInt = (raw: string | undefined, max: number) => {
  if (raw === undefined || !/^\d+$/.test(raw)) return undefined;
  const value = Number(raw);

  return Number.isSafeInteger(value) && value > 0 && value <= max
    ? value
    : undefined;
};

const listOf = (raw: string | undefined, allowed: readonly string[]) => {
  const values = [
    ...new Set(
      (raw ?? "")
        .split(",")
        .map(item => item.trim())
        .filter(item => allowed.includes(item)),
    ),
  ];

  return values.length > 0 ? values.join(",") : undefined;
};

export const normalizeStandingSearch = (
  input: Record<string, unknown>,
): StandingRouteSearch => {
  const page = positiveInt(asSearchValue(input.page), MAX_PAGE);
  const rawFirst = asSearchValue(input.first);
  const first =
    rawFirst === undefined ? undefined : readPageSize(rawFirst, 100);
  const search = asSearchValue(input.search)?.trim().slice(0, 100);
  const type = listOf(asSearchValue(input.type), KINDS);
  const status = listOf(asSearchValue(input.status), STATUSES);
  const orderBy = asSearchValue(input.orderBy);
  const order = asSearchValue(input.order);

  return {
    ...(page === undefined || page === 1 ? {} : { page }),
    ...(first === undefined || Number(first) === STANDING_PAGE_SIZE
      ? {}
      : { first: Number(first) }),
    ...(search ? { search } : {}),
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(orderBy === "points" ? { orderBy: "points" as const } : {}),
    ...(order === "asc" ? { order: "asc" as const } : {}),
  };
};

export const standingHistoryParams = (
  search: StandingRouteSearch,
): AccountStatusHistoryParams => ({
  order: search.order ?? "desc",
  orderBy: search.orderBy === "points" ? "points" : "issuedAt",
  page: search.page ?? 1,
  pageSize: search.first ?? STANDING_PAGE_SIZE,
  ...(search.search ? { search: search.search } : {}),
  ...(search.type ? { kind: search.type } : {}),
  ...(search.status ? { status: search.status } : {}),
});

export const standingSearchParams = (
  search: StandingRouteSearch,
): URLSearchParams =>
  new URLSearchParams(
    Object.entries({
      ...search,
      ...(search.orderBy || search.order
        ? {
            order: search.order ?? "desc",
            orderBy: search.orderBy === "points" ? "points" : "at",
          }
        : {}),
    })
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );

export const standingSearchFrom = (query: string): StandingRouteSearch =>
  normalizeStandingSearch(Object.fromEntries(new URLSearchParams(query)));

export const loadStandingRoute = async ({
  queryClient,
  search,
}: {
  queryClient: QueryClient;
  search: StandingRouteSearch;
}): Promise<void> => {
  await Promise.all([
    queryClient.query({
      ...accountStatusQueryOptions(),
      staleTime: "static",
    }),
    queryClient.query({
      ...accountStatusHistoryQueryOptions(standingHistoryParams(search)),
      staleTime: "static",
    }),
  ]);
};
