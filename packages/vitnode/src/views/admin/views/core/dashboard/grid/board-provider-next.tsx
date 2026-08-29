"use client";

import React from "react";

import { useRouter } from "@/lib/navigation";

import type { DashboardActions } from "../widgets/dashboard-actions";

import { loadWidgetContentAction } from "../widgets/load-widget-content.server";
import { loadWidgetSettingsAction } from "../widgets/load-widget-settings.server";
import { saveWidgetSettingsMutation } from "../widgets/save-widget-settings.server";
import { DashboardBoardProvider } from "./board-provider";
import { saveDashboardLayoutMutation } from "./save-layout.server";

/**
 * The dashboard board, with Next.js's four actions bound to it.
 *
 * The server actions unchanged, plus the `router.refresh()` the provider used to
 * call itself. It exists for one reason: `router.refresh()` needs the router,
 * the router needs a client component, and `DashboardBoard` - which fetches the
 * layout and renders every widget on the server - is a Server Component. Same
 * shape as `SearchIndexView` on the search screen, for the same reason.
 *
 * Memoised so the board's own `useCallback`s do not see a new `actions` object
 * on every render.
 */
export const DashboardBoardProviderNext = ({
  children,
  ...props
}: Omit<React.ComponentProps<typeof DashboardBoardProvider>, "actions">) => {
  const router = useRouter();

  const actions = React.useMemo<DashboardActions>(
    () => ({
      loadWidgetContent: async widgetId =>
        await loadWidgetContentAction({ widgetId }),
      loadWidgetSettings: async widgetId =>
        await loadWidgetSettingsAction({ widgetId }),
      saveLayout: async args => {
        const result = await saveDashboardLayoutMutation(args);

        // Only on success: a refused save leaves the stored layout as it was,
        // and refreshing would replace the working copy the administrator is
        // still being told about.
        if (!result?.error) router.refresh();

        return result;
      },
      saveWidgetSettings: async args => await saveWidgetSettingsMutation(args),
    }),
    [router],
  );

  return (
    <DashboardBoardProvider actions={actions} {...props}>
      {children}
    </DashboardBoardProvider>
  );
};
