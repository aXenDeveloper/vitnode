import type { QueryClient } from "@tanstack/react-query";

import type { PluginRouteTranslator } from "@/routing";
import type { ModcpWarningsFilter } from "@/views/moderation/warnings/warnings-api";

import { asSearchValue, readPageSize } from "@/lib/table-params";
import { warningsListQueryOptions } from "@/views/moderation/warnings/warnings-api";

import type { AuthenticatedState } from "../auth/state";
import type { ModcpRouteData } from "./route";

import { requireModeratorRoute } from "./route";

export const MODCP_WARNINGS_PAGE_SIZE = 25;
const MAX_PAGE = 10_000;
const MAX_ID = 2_147_483_647;
const STATUSES = ["active", "expired", "revoked"] as const;

export interface ModcpWarningsRouteSearch {
  first?: number;
  page?: number;
  reason?: number;
  status?: (typeof STATUSES)[number];
  user?: number;
}

const positiveInt = (raw: string | undefined, max: number) => {
  if (raw === undefined || !/^\d+$/.test(raw)) return undefined;
  const value = Number(raw);

  return Number.isSafeInteger(value) && value > 0 && value <= max
    ? value
    : undefined;
};

export const normalizeModcpWarningsSearch = (
  input: Record<string, unknown>,
): ModcpWarningsRouteSearch => {
  const status = STATUSES.find(value => value === asSearchValue(input.status));
  const reason = positiveInt(asSearchValue(input.reason), MAX_ID);
  const user = positiveInt(asSearchValue(input.user), MAX_ID);
  const page = positiveInt(asSearchValue(input.page), MAX_PAGE);
  const rawFirst = asSearchValue(input.first);
  const first =
    rawFirst === undefined ? undefined : readPageSize(rawFirst, 100);

  return {
    ...(status ? { status } : {}),
    ...(reason === undefined ? {} : { reason }),
    ...(user === undefined ? {} : { user }),
    ...(page === undefined || page === 1 ? {} : { page }),
    ...(first === undefined || Number(first) === MODCP_WARNINGS_PAGE_SIZE
      ? {}
      : { first: Number(first) }),
  };
};

export const modcpWarningsFilter = (
  search: ModcpWarningsRouteSearch,
): ModcpWarningsFilter => ({
  page: search.page ?? 1,
  pageSize: search.first ?? MODCP_WARNINGS_PAGE_SIZE,
  status: search.status ?? "all",
  ...(search.reason === undefined ? {} : { reasonId: search.reason }),
  ...(search.user === undefined ? {} : { userId: search.user }),
});

export const modcpWarningsSearchParams = (
  search: ModcpWarningsRouteSearch,
): URLSearchParams =>
  new URLSearchParams(
    Object.entries(search)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );

export const modcpWarningsSearchFrom = (
  query: string,
): ModcpWarningsRouteSearch =>
  normalizeModcpWarningsSearch(Object.fromEntries(new URLSearchParams(query)));

export const loadModcpWarningsRoute = async ({
  auth,
  queryClient,
  search,
  t,
}: {
  auth: AuthenticatedState;
  queryClient: QueryClient;
  search: ModcpWarningsRouteSearch;
  t: PluginRouteTranslator;
}): Promise<ModcpRouteData> => {
  requireModeratorRoute(auth);
  await queryClient.query({
    ...warningsListQueryOptions(modcpWarningsFilter(search)),
    staleTime: "static",
  });

  return {
    description: t("core.moderation.warn.list.desc"),
    title: t("core.moderation.warn.list.title"),
  };
};
