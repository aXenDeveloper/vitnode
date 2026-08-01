import type { AdminDashboardWidgetProps } from "@/lib/plugin";

import { SendNotificationSettingsForm } from "./send-notification-settings-form";

export const SendNotificationSettings = ({
  settings,
}: AdminDashboardWidgetProps) => (
  <SendNotificationSettingsForm
    defaultTitle={
      typeof settings.defaultTitle === "string" ? settings.defaultTitle : ""
    }
  />
);
