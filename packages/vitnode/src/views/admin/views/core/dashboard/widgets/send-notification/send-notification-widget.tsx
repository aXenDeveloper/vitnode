import type { AdminDashboardWidgetProps } from "@/lib/plugin";

import { getSessionAdminApi } from "@/lib/api/get-session-admin-api";

import { SendNotificationAction } from "./send-notification";

export const SendNotificationWidget = async ({
  settings,
}: AdminDashboardWidgetProps) => {
  const session = await getSessionAdminApi();
  if (!session) return null;

  return (
    <SendNotificationAction
      defaultTitle={
        typeof settings.defaultTitle === "string" ? settings.defaultTitle : ""
      }
      defaultUserId={session.user.id}
    />
  );
};
