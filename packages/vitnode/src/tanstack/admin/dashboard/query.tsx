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

/**
 * The dashboard for a TanStack Start host: the layout query, and the four
 * actions the board performs.
 *
 * The transport boundary is the same one every AdminCP read uses - both branches
 * call Hono directly, and the admin cookie travels on both. See
 * `tanstack/admin/cron/query.ts` for the full argument.
 */
const fetchDashboardLayout: DashboardLayoutFetcher = createIsomorphicFn()
  .server(fetchDashboardLayoutOnServer)
  .client(fetchDashboardLayoutInBrowser);

/**
 * The stored layout, as the one query definition every caller shares.
 *
 * `adminUserId` travels with it because the entry is partitioned by identity -
 * one board per administrator, one cache entry per administrator. The loader
 * takes it from the session the guard already resolved; a component takes it
 * from {@link useAdminIdentity}, which reads that same entry, so the two cannot
 * disagree about whose board they are looking at.
 */
export const dashboardLayoutQuery = (adminUserId: AdminIdentity) =>
  dashboardLayoutQueryOptions({
    adminUserId,
    fetchLayout: fetchDashboardLayout,
  });

/**
 * Marks the stored layout stale, so the board re-reads what a save changed.
 *
 * One entry rather than a family: there is exactly one layout per administrator
 * and one cache entry for it. It is scoped rather than global - a dashboard save
 * has not changed the cron list, and refetching everything because a card moved
 * is the blunt version of the `revalidatePath` this replaces.
 */
export const invalidateDashboardLayout = async (
  queryClient: QueryClient,
  adminUserId: AdminIdentity,
): Promise<void> =>
  await queryClient.invalidateQueries({
    queryKey: dashboardLayoutQueryKey(adminUserId),
  });

/**
 * The four board actions, bound to the mounted router's cache and to the widget
 * catalogue this browser can render.
 *
 * The TanStack half of the pair whose other half is `DashboardBoardProviderNext`.
 * Both satisfy `DashboardActions`, which is what lets one board be driven by
 * either framework.
 *
 * ## The two loads render here rather than on a server
 *
 * In Next.js "refresh this widget" is necessarily a server round trip: a
 * widget's `component` may be a Server Component, so only its *output* can cross
 * back. A browser has the component, so all it needs is the settings - and it
 * re-reads those through `fetchQuery` on the same layout entry, which is a
 * request only when the entry is stale. The result is the same promise-of-a-node
 * the board already knows how to hold.
 *
 * `fetchQuery` and not `getQueryData`: the settings dialog calls this
 * immediately after saving, and the point of the call is to see what was saved.
 * Reading whatever happens to be cached would render the widget against the
 * settings it already had.
 *
 * ## Only a successful save refreshes
 *
 * A refused layout save leaves the stored board as it was, and invalidating
 * would replace the working copy the administrator is still being told about -
 * the same rule the Next.js action applies before `revalidatePath`.
 */
export const useDashboardActions = (
  widgets: ResolvedDashboardWidget[],
): DashboardActions => {
  const queryClient = useQueryClient();
  /**
   * Whose board these actions read and write.
   *
   * From the `["vitnode","admin-session"]` entry the guard refreshes on every
   * navigation, so an identity that changed under this tab - a second
   * administrator signing in elsewhere in the browser - moves these actions onto
   * the new key rather than leaving them writing into the previous one's row.
   */
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
