import type { QueryClient } from "@tanstack/react-query";
import type { AnyRouter } from "@tanstack/react-router";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import React from "react";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";
import type { DebugLogsParams } from "@/views/admin/views/core/debug/debug-query";
import type { DebugSources } from "@/views/admin/views/core/debug/health/health";

import { hasStaffPermission } from "@/api/lib/staff-permission";
import { cronHealthQueryOptions } from "@/views/admin/views/core/advanced/cron/cron-query";
import {
  debugLogsQueryOptions,
  debugQueueQueryOptions,
  fetchDebugLogsPage,
  fetchDebugQueue,
} from "@/views/admin/views/core/debug/debug-query";
import { ADMIN_DEBUG_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";
import { integrationsQueryOptions } from "@/views/admin/views/core/system/integrations/integrations-query";
import { pluginUpdatesQueryOptions } from "@/views/admin/views/core/system/plugins/plugin-updates-query";
import { installedPluginsQueryOptions } from "@/views/admin/views/core/system/plugins/plugins-query";

import { useAdminPermissions } from "../permissions";
import { searchIndexQuery } from "../search-index/query";

export const debugLogsQuery = ({ params }: { params: DebugLogsParams }) =>
  debugLogsQueryOptions({ fetchPage: fetchDebugLogsPage, params });

export const debugQueueQuery = () =>
  debugQueueQueryOptions({ fetchSnapshot: fetchDebugQueue });

const STATIC = { staleTime: "static" } as const;

export const debugSourceQueries = () =>
  ({
    cronHealth: {
      options: cronHealthQueryOptions(),
      permission: ADMIN_DEBUG_PERMISSIONS.cron,
    },
    installed: {
      options: installedPluginsQueryOptions(),
      permission: ADMIN_DEBUG_PERMISSIONS.plugins,
    },
    integrations: {
      options: integrationsQueryOptions(),
      permission: ADMIN_DEBUG_PERMISSIONS.system,
    },
    queue: {
      options: debugQueueQuery(),
      permission: ADMIN_DEBUG_PERMISSIONS.view,
    },
    search: {
      options: searchIndexQuery(),
      permission: ADMIN_DEBUG_PERMISSIONS.system,
    },
    updates: {
      options: pluginUpdatesQueryOptions(),
      permission: ADMIN_DEBUG_PERMISSIONS.plugins,
    },
  }) as const;

export const warmDebugSources = async (
  queryClient: QueryClient,
  can: (args: PermissionsStaffArgs) => boolean,
): Promise<void> => {
  const sources = debugSourceQueries();
  const warm = async (
    permission: PermissionsStaffArgs,
    read: () => Promise<unknown>,
  ): Promise<void> => {
    if (!can(permission)) return;
    await read().catch(() => undefined);
  };

  await Promise.all([
    warm(sources.cronHealth.permission, async () =>
      queryClient.query({ ...sources.cronHealth.options, ...STATIC }),
    ),
    warm(sources.installed.permission, async () =>
      queryClient.query({ ...sources.installed.options, ...STATIC }),
    ),
    warm(sources.integrations.permission, async () =>
      queryClient.query({ ...sources.integrations.options, ...STATIC }),
    ),
    warm(sources.queue.permission, async () =>
      queryClient.query({ ...sources.queue.options, ...STATIC }),
    ),
    warm(sources.search.permission, async () =>
      queryClient.query({ ...sources.search.options, ...STATIC }),
    ),
    warm(sources.updates.permission, async () =>
      queryClient.query({ ...sources.updates.options, ...STATIC }),
    ),
  ]);
};

export const useDebugSources = (): DebugSources => {
  const permissions = useAdminPermissions();
  const sources = debugSourceQueries();
  const can = (args: PermissionsStaffArgs) =>
    hasStaffPermission(permissions, args);

  const cronHealth = useQuery({
    ...sources.cronHealth.options,
    enabled: can(sources.cronHealth.permission),
  });
  const installed = useQuery({
    ...sources.installed.options,
    enabled: can(sources.installed.permission),
  });
  const integrations = useQuery({
    ...sources.integrations.options,
    enabled: can(sources.integrations.permission),
  });
  const queue = useQuery({
    ...sources.queue.options,
    enabled: can(sources.queue.permission),
  });
  const search = useQuery({
    ...sources.search.options,
    enabled: can(sources.search.permission),
  });
  const updates = useQuery({
    ...sources.updates.options,
    enabled: can(sources.updates.permission),
  });

  return {
    cronHealth: cronHealth.data,
    installed: installed.data,
    integrations: integrations.data,
    queue: queue.data,
    search: search.data,
    updates: updates.data,
  };
};

export const useRecheckDebugSources = (): {
  isPending: boolean;
  recheck: () => void;
} => {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = React.useTransition();

  const recheck = () => {
    startTransition(async () => {
      await Promise.all(
        Object.values(debugSourceQueries()).map(
          async source =>
            await queryClient.refetchQueries({
              queryKey: source.options.queryKey,
            }),
        ),
      );
    });
  };

  return { isPending, recheck };
};

export const clearAdminCache = async (
  queryClient: QueryClient,
  router: AnyRouter,
): Promise<void> => {
  await queryClient.invalidateQueries();
  await router.invalidate();
};

export const useClearAdminCache = (): (() => Promise<void>) => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return React.useMemo(
    () => async () => {
      await clearAdminCache(queryClient, router);
    },
    [queryClient, router],
  );
};
