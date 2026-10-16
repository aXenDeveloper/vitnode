import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";
import type { PluginRouteTranslator } from "@/routing";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { ADMIN_DEBUG_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";

import type { AiHistoryRouteSearch } from "../ai/route-search";
import type { CronRouteSearch } from "../cron/route-search";
import type { QueueRouteSearch } from "../queue/route-search";
import type { AdminScreenContext } from "../screen";
import type { SearchIndexRouteSearch } from "../search-index/route-search";
import type { DebugLogsRouteSearch, DebugTab } from "./route-search";

import { defineAdminRoute } from "../../plugin-routes/authoring";
import {
  adminAiActionsQuery,
  adminAiHistoryQuery,
  adminAiModelsQuery,
} from "../ai/query";
import { aiHistoryRouteParams } from "../ai/route-search";
import { cronQuery } from "../cron/query";
import { adminIdentityOf } from "../identity";
import { queueQuery } from "../queue/query";
import { queueRouteParams } from "../queue/route-search";
import { requireAdminPermission } from "../screen";
import { hasAdminPermission } from "../state";
import { debugTabCrumb } from "./crumb";
import { debugLogsQuery, warmDebugSources } from "./query";
import { debugCronParams, debugLogsRouteParams } from "./route-search";
import { DEBUG_TAB_PERMISSION } from "./tabs";

export const ADMIN_DEBUG_NAMESPACES = [
  "admin.advanced.cron",
  "admin.advanced.queue",
  "admin.ai",
  "admin.debug",
  "admin.system.integrations",
  "admin.system.plugins",
  "ai_actions",
  "core.global",
  "core.search",
] as const;

export interface AdminDebugLayoutData {
  adminUserId: AdminIdentity;
  description: string;
  title: string;
}

const STATIC = { staleTime: "static" } as const;

export const loadAdminDebugLayout = async ({
  adminAccess,
  queryClient,
  t,
}: AdminScreenContext & {
  t: PluginRouteTranslator;
}): Promise<AdminDebugLayoutData> => {
  requireAdminPermission(adminAccess, ADMIN_DEBUG_PERMISSIONS.view);

  await warmDebugSources(queryClient, (args: PermissionsStaffArgs) =>
    hasAdminPermission(adminAccess, args),
  );

  return {
    adminUserId: adminIdentityOf(adminAccess),
    description: t("admin.debug.desc"),
    title: t("admin.debug.title"),
  };
};

const debugTabRoute = <TSearch = Record<string, never>,>(
  tab: DebugTab,
  warm?: (args: {
    context: AdminScreenContext;
    search: TSearch;
  }) => Promise<unknown>,
) =>
  defineAdminRoute<undefined, TSearch>({
    load: async ({ context, search }) => {
      requireAdminPermission(context.adminAccess, DEBUG_TAB_PERMISSION[tab]);
      await warm?.({ context, search });

      return undefined;
    },

    ...(tab === "overview" ? {} : { breadcrumb: debugTabCrumb(tab) }),
  });

export const debugOverviewRoute = debugTabRoute("overview");
export const debugVitnodeRoute = debugTabRoute("vitnode");
export const debugPluginsRoute = debugTabRoute("plugins");
export const debugCacheRoute = debugTabRoute("cache");
export const debugServicesRoute = debugTabRoute("services");
export const debugSearchRoute = debugTabRoute<SearchIndexRouteSearch>("search");

export const debugCronRoute = debugTabRoute<CronRouteSearch>(
  "cron",
  async ({ context, search }) =>
    await context.queryClient.query({
      ...cronQuery({ params: debugCronParams(search) }),
      ...STATIC,
    }),
);

export const debugLogsRoute = debugTabRoute<DebugLogsRouteSearch>(
  "logs",
  async ({ context, search }) =>
    await context.queryClient.query({
      ...debugLogsQuery({ params: debugLogsRouteParams(search) }),
      ...STATIC,
    }),
);

export const debugQueueRoute = debugTabRoute<QueueRouteSearch>(
  "queue",
  async ({ context, search }) =>
    await context.queryClient.query({
      ...queueQuery({ params: queueRouteParams(search) }),
      ...STATIC,
    }),
);

export const debugAiRoute = debugTabRoute<AiHistoryRouteSearch>(
  "ai",
  async ({ context, search }) => {
    const adminUserId = adminIdentityOf(context.adminAccess);

    await Promise.all([
      context.queryClient.query({
        ...adminAiHistoryQuery({
          adminUserId,
          params: aiHistoryRouteParams(search),
        }),
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
  },
);
