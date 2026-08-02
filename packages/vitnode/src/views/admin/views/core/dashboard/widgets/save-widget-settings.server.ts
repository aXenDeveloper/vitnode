"use server";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

export const saveWidgetSettingsMutation = async ({
  settings,
  widgetId,
}: {
  settings: Record<string, unknown>;
  widgetId: string;
}) => {
  const res = await fetcher(adminModule, {
    path: "/widget-settings",
    method: "put",
    module: "admin/dashboard",
    args: {
      body: { settings, widgetId },
    },
  });

  if (!res.ok) {
    return { error: await res.text() };
  }
};
