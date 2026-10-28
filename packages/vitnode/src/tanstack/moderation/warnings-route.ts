import type { QueryClient } from "@tanstack/react-query";

import { notFound } from "@tanstack/react-router";

import type { PluginRouteTranslator } from "@/routing";
import type { ModcpWarningsFilter } from "@/views/moderation/warnings/warnings-api";

import { asSearchValue, readPageSize } from "@/lib/table-params";
import { ModcpRequestError } from "@/views/moderation/modcp/modcp-query";
import {
  memberStandingQueryOptions,
  warningsListQueryOptions,
} from "@/views/moderation/warnings/warnings-api";

import type { AuthenticatedState } from "../auth/state";
import type { ModcpRouteData } from "./route";

import { requireModeratorRoute, routeIdOf, withNotFound } from "./route";

export const MODCP_WARNINGS_PAGE_SIZE = 25;
const MAX_PAGE = 10_000;
const MAX_ID = 2_147_483_647;
const STATUSES = ["active", "expired", "revoked"] as const;

export interface ModcpWarningsRouteSearch {
  first?: number;
  page?: number;
  reason?: number;
  /** `all` is what the URL says by saying nothing. */
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
  const status = asSearchValue(input.status);
  const reason = positiveInt(asSearchValue(input.reason), MAX_ID);
  const user = positiveInt(asSearchValue(input.user), MAX_ID);
  const page = positiveInt(asSearchValue(input.page), MAX_PAGE);
  const rawFirst = asSearchValue(input.first);
  const first =
    rawFirst === undefined ? undefined : readPageSize(rawFirst, 100);

  return {
    ...(STATUSES.find(value => value === status)
      ? { status: status as (typeof STATUSES)[number] }
      : {}),
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

export interface ModcpMemberRouteData extends ModcpRouteData {
  id: number;
}

export const loadModcpMemberRoute = async ({
  auth,
  id: raw,
  queryClient,
  t,
}: {
  auth: AuthenticatedState;
  id: string;
  queryClient: QueryClient;
  t: PluginRouteTranslator;
}): Promise<ModcpMemberRouteData> => {
  requireModeratorRoute(auth);
  const id = routeIdOf(raw);
  let name = "";
  try {
    await withNotFound(async () => {
      const standing = await queryClient.query({
        ...memberStandingQueryOptions(id),
        staleTime: "static",
      });
      name = standing.user.name;
    });
  } catch (error) {
    // A moderator who may neither warn nor view warnings gets the same 404.
    if (error instanceof ModcpRequestError && error.status === 403) {
      // oxlint-disable-next-line typescript/only-throw-error
      throw notFound();
    }
    throw error;
  }

  return {
    description: t("core.moderation.warn.member.desc"),
    id,
    title: t("core.moderation.warn.member.title", { name }),
  };
};
