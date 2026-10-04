import type { PluginRouteTranslator } from "@/routing";
import type {
  AiHistoryParams,
  AiOverviewPeriod,
} from "@/views/admin/views/core/ai/ai-query";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { ADMIN_AI_PERMISSIONS } from "@/views/admin/views/core/ai/ai-permissions";

import type { AdminScreenContext } from "../screen";

import { adminIdentityOf } from "../identity";
import { requireAdminPermission } from "../screen";
import {
  adminAiAccessQuery,
  adminAiActionsQuery,
  adminAiAltStatusQuery,
  adminAiHistoryQuery,
  adminAiModelsQuery,
  adminAiOverviewQuery,
  adminAiSettingsQuery,
} from "./query";

/**
 * `/admin/core/ai/*`, as everything a TanStack Start route needs and nothing
 * a route owns. Every screen reads `ai:can_view`; writes are gated on
 * `ai:can_manage` in the screens themselves.
 */

export const ADMIN_AI_NAMESPACES = ["admin.ai", "core.global"] as const;

export interface AdminAiRouteData {
  adminUserId: AdminIdentity;
  description: string;
  title: string;
}

export interface AdminAiOverviewRouteData extends AdminAiRouteData {
  period: AiOverviewPeriod;
}

export interface AdminAiHistoryRouteData extends AdminAiRouteData {
  params: AiHistoryParams;
}

type AdminAiLoaderContext = AdminScreenContext & { t: PluginRouteTranslator };

const STATIC = { staleTime: "static" } as const;

/** The permission check and the identity every AI screen starts from. */
const enter = ({ adminAccess }: AdminAiLoaderContext): AdminIdentity => {
  requireAdminPermission(adminAccess, ADMIN_AI_PERMISSIONS.view);

  return adminIdentityOf(adminAccess);
};

export const loadAdminAiOverviewRoute = async (
  context: AdminAiLoaderContext & { period: AiOverviewPeriod },
): Promise<AdminAiOverviewRouteData> => {
  const adminUserId = enter(context);

  await Promise.all([
    context.queryClient.query({
      ...adminAiOverviewQuery({ adminUserId, period: context.period }),
      ...STATIC,
    }),
    context.queryClient.query({
      ...adminAiActionsQuery({ adminUserId }),
      ...STATIC,
    }),
  ]);

  return {
    adminUserId,
    description: context.t("admin.ai.overview.desc"),
    period: context.period,
    title: context.t("admin.ai.overview.title"),
  };
};

export const loadAdminAiSettingsRoute = async (
  context: AdminAiLoaderContext,
): Promise<AdminAiRouteData> => {
  const adminUserId = enter(context);

  await Promise.all([
    context.queryClient.query({
      ...adminAiSettingsQuery({ adminUserId }),
      ...STATIC,
    }),
    context.queryClient.query({
      ...adminAiAltStatusQuery({ adminUserId }),
      ...STATIC,
    }),
  ]);

  return {
    adminUserId,
    description: context.t("admin.ai.settings.desc"),
    title: context.t("admin.ai.settings.title"),
  };
};

export const loadAdminAiModelsRoute = async (
  context: AdminAiLoaderContext,
): Promise<AdminAiRouteData> => {
  const adminUserId = enter(context);

  await context.queryClient.query({
    ...adminAiModelsQuery({ adminUserId }),
    ...STATIC,
  });

  return {
    adminUserId,
    description: context.t("admin.ai.models.desc"),
    title: context.t("admin.ai.models.title"),
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

export const loadAdminAiAccessRoute = async (
  context: AdminAiLoaderContext,
): Promise<AdminAiRouteData> => {
  const adminUserId = enter(context);

  await Promise.all([
    context.queryClient.query({
      ...adminAiAccessQuery({ adminUserId }),
      ...STATIC,
    }),
    context.queryClient.query({
      ...adminAiActionsQuery({ adminUserId }),
      ...STATIC,
    }),
  ]);

  return {
    adminUserId,
    description: context.t("admin.ai.access.desc"),
    title: context.t("admin.ai.access.title"),
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
