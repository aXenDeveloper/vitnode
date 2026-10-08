import type { PluginRouteTranslator } from "@/routing";
import type {
  AiHistoryParams,
  AiOverviewSearch,
} from "@/views/admin/views/core/ai/ai-query";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { ADMIN_AI_PERMISSIONS } from "@/views/admin/views/core/ai/ai-permissions";
import { ADMIN_AI_SCREEN } from "@/views/admin/views/core/ai/ai-query";
import { adminScopedQueryKey } from "@/views/admin/views/core/shared/admin-scope";

import type { AdminScreenContext } from "../screen";
import type { AiOverviewRouteSearch } from "./route-search";

import { adminIdentityOf } from "../identity";
import { requireAdminPermission } from "../screen";
import {
  adminAiActionsQuery,
  adminAiHistoryQuery,
  adminAiModelsQuery,
  adminAiOverviewQuery,
  adminAiSettingsQuery,
} from "./query";

export const ADMIN_AI_NAMESPACES = [
  "admin.ai",
  "ai_actions",
  "core.global",
] as const;

export interface AdminAiRouteData {
  adminUserId: AdminIdentity;
  description: string;
  title: string;
}

export interface AdminAiOverviewRouteData extends AdminAiRouteData {
  search: AiOverviewSearch;
}

export interface AdminAiHistoryRouteData extends AdminAiRouteData {
  params: AiHistoryParams;
}

type AdminAiLoaderContext = AdminScreenContext & { t: PluginRouteTranslator };

const STATIC = { staleTime: "static" } as const;

const enter = ({ adminAccess }: AdminAiLoaderContext): AdminIdentity => {
  requireAdminPermission(adminAccess, ADMIN_AI_PERMISSIONS.view);

  return adminIdentityOf(adminAccess);
};

export const loadAdminAiOverviewRoute = async (
  context: AdminAiLoaderContext & { search: AiOverviewRouteSearch },
): Promise<AdminAiOverviewRouteData> => {
  const adminUserId = enter(context);
  const { settings, ...search } = context.search;
  const overview = context.queryClient.query({
    ...adminAiOverviewQuery({ adminUserId, search }),
    ...STATIC,
  });

  if (settings === "open") {
    void context.queryClient
      .query({ ...adminAiSettingsQuery({ adminUserId }), ...STATIC })
      .catch(() => undefined);
  }
  const showingOverview = context.queryClient
    .getQueriesData({
      queryKey: adminScopedQueryKey(ADMIN_AI_SCREEN, adminUserId, "overview"),
    })
    .some(([, data]) => data !== undefined);

  if (showingOverview) void overview.catch(() => undefined);

  await Promise.all([
    showingOverview ? undefined : overview,
    context.queryClient.query({
      ...adminAiActionsQuery({ adminUserId }),
      ...STATIC,
    }),
    context.queryClient.query({
      ...adminAiModelsQuery({ adminUserId }),
      ...STATIC,
    }),
  ]);

  return {
    adminUserId,
    description: context.t("admin.ai.overview.desc"),
    search,
    title: context.t("admin.ai.overview.title"),
  };
};

export const loadAdminAiActionsRoute = async (
  context: AdminAiLoaderContext,
): Promise<AdminAiRouteData> => {
  const adminUserId = enter(context);

  await Promise.all([
    context.queryClient.query({
      ...adminAiActionsQuery({ adminUserId }),
      ...STATIC,
    }),
    context.queryClient.query({
      ...adminAiModelsQuery({ adminUserId }),
      ...STATIC,
    }),
  ]);

  return {
    adminUserId,
    description: context.t("admin.ai.actions.desc"),
    title: context.t("admin.ai.actions.title"),
  };
};

export const loadAdminAiHistoryRoute = async (
  context: AdminAiLoaderContext & { params: AiHistoryParams },
): Promise<AdminAiHistoryRouteData> => {
  const adminUserId = enter(context);

  await Promise.all([
    context.queryClient.query({
      ...adminAiHistoryQuery({ adminUserId, params: context.params }),
      ...STATIC,
    }),
    context.queryClient.query({
      ...adminAiActionsQuery({ adminUserId }),
      ...STATIC,
    }),
    context.queryClient.query({
      ...adminAiModelsQuery({ adminUserId }),
      ...STATIC,
    }),
  ]);

  return {
    adminUserId,
    description: context.t("admin.ai.history.desc"),
    params: context.params,
    title: context.t("admin.ai.history.title"),
  };
};
