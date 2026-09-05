import type { z } from "zod";

import type { adminModule } from "@/api/modules/admin/admin.module";
import type { zodSendNotificationSchema } from "@/api/modules/admin/routes/notifications.route";

import { fetcherClient } from "@/lib/fetcher-client";
import { adminModuleRef } from "@/views/admin/admin-request";

import type { DashboardMutationResult } from "./dashboard-actions";

const adminModuleClientRef = adminModuleRef<typeof adminModule>();

/** One widget's settings, saved. */
export const saveWidgetSettingsInBrowser = async ({
  settings,
  widgetId,
}: {
  settings: Record<string, unknown>;
  widgetId: string;
}): Promise<DashboardMutationResult> => {
  try {
    const response = await fetcherClient(adminModuleClientRef, {
      args: { body: { settings, widgetId } },
      method: "put",
      module: "admin/dashboard",
      options: { credentials: "include" },
      path: "/widget-settings",
    });

    if (!response.ok) return { error: await response.text() };

    return undefined;
  } catch {
    // `rawApiFetch` throws on a 500 with the server's own error text, already
    // logged where a log belongs. The caller needs an outcome, not a stack.
    return { error: "Failed to save the widget settings." };
  }
};

/** One notification, sent to one user. */
export const sendNotificationInBrowser = async (
  body: z.infer<typeof zodSendNotificationSchema>,
): Promise<DashboardMutationResult> => {
  try {
    const response = await fetcherClient(adminModuleClientRef, {
      args: { body },
      method: "post",
      module: "admin",
      options: { credentials: "include" },
      path: "/notifications/send",
    });

    if (!response.ok) return { error: await response.text() };

    return undefined;
  } catch {
    return { error: "Failed to send the notification." };
  }
};
