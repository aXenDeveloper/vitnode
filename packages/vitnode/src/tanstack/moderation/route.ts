import type { QueryClient } from "@tanstack/react-query";

import { notFound } from "@tanstack/react-router";

import type { PluginRouteTranslator } from "@/routing";
import type { BoardPerson } from "@/views/moderation/modcp/board/board-moves";

import {
  MODCP_BOARD_STATUSES,
  modcpBoardColumnQueryOptions,
  modcpReportQueryOptions,
  ModcpRequestError,
} from "@/views/moderation/modcp/modcp-query";

import type { AuthenticatedState } from "../auth/state";
import type { ModcpReportsRouteSearch } from "./route-search";

import { modcpBoardFilter } from "./route-search";

export interface ModcpRouteData {
  description: string;
  title: string;
}

export interface ModcpReportsRouteData extends ModcpRouteData {
  me: BoardPerson;
}

export const requireModeratorRoute = (auth: AuthenticatedState): void => {
  if (!auth.user.isModerator) {
    // oxlint-disable-next-line typescript/only-throw-error
    throw notFound();
  }
};

export const loadModcpReportsRoute = async ({
  auth,
  queryClient,
  search,
  t,
}: {
  auth: AuthenticatedState;
  queryClient: QueryClient;
  search: ModcpReportsRouteSearch;
  t: PluginRouteTranslator;
}): Promise<ModcpReportsRouteData> => {
  requireModeratorRoute(auth);
  const filter = modcpBoardFilter(search);
  await Promise.all(
    MODCP_BOARD_STATUSES.map(
      async status =>
        await queryClient.infiniteQuery({
          ...modcpBoardColumnQueryOptions(status, filter),
          staleTime: "static",
        }),
    ),
  );

  const { user } = auth;

  return {
    description: t("core.moderation.modcp.reports.desc"),
    me: {
      avatarColor: user.avatarColor,
      avatarUrl: user.avatarUrl,
      id: user.id,
      name: user.name,
      nameCode: user.nameCode,
      role: { color: null, prefix: null },
    },
    title: t("core.moderation.modcp.reports.title"),
  };
};

export interface ModcpReportRouteData extends ModcpRouteData {
  id: number;
  userId: number;
}

export const loadModcpReportRoute = async ({
  auth,
  id: raw,
  queryClient,
  t,
}: {
  auth: AuthenticatedState;
  id: string;
  queryClient: QueryClient;
  t: PluginRouteTranslator;
}): Promise<ModcpReportRouteData> => {
  requireModeratorRoute(auth);
  const id = /^[1-9]\d{0,9}$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(id) || id > 2_147_483_647) {
    // oxlint-disable-next-line typescript/only-throw-error
    throw notFound();
  }

  try {
    await queryClient.query({
      ...modcpReportQueryOptions(id),
      staleTime: "static",
    });
  } catch (error) {
    if (error instanceof ModcpRequestError && error.status === 404) {
      // oxlint-disable-next-line typescript/only-throw-error
      throw notFound();
    }
    throw error;
  }

  return {
    description: t("core.moderation.modcp.reports.desc"),
    id,
    title: t("core.moderation.modcp.detail.title", { id }),
    userId: auth.user.id,
  };
};
