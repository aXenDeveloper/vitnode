"use client";

import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import React from "react";

import type { DashboardActions } from "@/views/admin/views/core/dashboard/widgets/dashboard-actions";
import type { DashboardLayoutFetcher } from "@/views/admin/views/core/dashboard/widgets/layout-query";
import type { ResolvedDashboardWidget } from "@/views/admin/views/core/dashboard/widgets/types";

import { widgetIdOf } from "@/views/admin/views/core/dashboard/widgets/instance-id";
import {
  dashboardLayoutQueryKey,
  dashboardLayoutQueryOptions,
  fetchDashboardLayoutInBrowser,
  saveDashboardLayoutInBrowser,
} from "@/views/admin/views/core/dashboard/widgets/layout-query";
import { saveWidgetSettingsInBrowser } from "@/views/admin/views/core/dashboard/widgets/widget-mutations";

import type { AdminIdentity } from "../identity";

import { useAdminIdentity } from "../identity";
import { fetchDashboardLayoutOnServer } from "./server";

const fetchDashboardLayout: DashboardLayoutFetcher = createIsomorphicFn()
  .server(fetchDashboardLayoutOnServer)
  .client(fetchDashboardLayoutInBrowser);

export const dashboardLayoutQuery = (adminUserId: AdminIdentity) =>
  dashboardLayoutQueryOptions({
    adminUserId,
    fetchLayout: fetchDashboardLayout,
  });

export const invalidateDashboardLayout = async (
  queryClient: QueryClient,
  adminUserId: AdminIdentity,
): Promise<void> =>
  await queryClient.invalidateQueries({
    queryKey: dashboardLayoutQueryKey(adminUserId),
  });

export const useDashboardActions = (
  widgets: ResolvedDashboardWidget[],
): DashboardActions => {
  const queryClient = useQueryClient();

  const adminUserId = useAdminIdentity();

  return React.useMemo<DashboardActions>(() => {
    /** The stored settings for one placed widget, read fresh. */
    const settingsFor = async (widgetId: string) => {
      const saved = await queryClient.fetchQuery(
        dashboardLayoutQuery(adminUserId),
      );

      return saved.find(item => item.id === widgetId)?.settings ?? {};
    };

    const widgetFor = (widgetId: string) =>
      widgets.find(({ id }) => id === widgetIdOf(widgetId));

    return {
      loadWidgetContent: async widgetId => {
        const widget = widgetFor(widgetId);
        if (!widget) return null;

        const Widget = widget.component;

        return (
          <Widget settings={await settingsFor(widgetId)} widgetId={widgetId} />
        );
      },
      loadWidgetSettings: async widgetId => {
        const Settings = widgetFor(widgetId)?.settingsComponent;
        if (!Settings) return null;

        return (
          <Settings
            settings={await settingsFor(widgetId)}
            widgetId={widgetId}
          />
        );
      },
      saveLayout: async args => {
        const result = await saveDashboardLayoutInBrowser(args);

        if (!result?.error)
          await invalidateDashboardLayout(queryClient, adminUserId);

        return result;
      },
      saveWidgetSettings: async args => {
        const result = await saveWidgetSettingsInBrowser(args);

        if (!result?.error)
          await invalidateDashboardLayout(queryClient, adminUserId);

        return result;
      },
    };
  }, [adminUserId, queryClient, widgets]);
};
