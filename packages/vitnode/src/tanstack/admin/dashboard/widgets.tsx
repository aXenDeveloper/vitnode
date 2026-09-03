"use client";

import { NotebookPenIcon, SendIcon } from "lucide-react";

import type {
  AdminDashboardWidget,
  AdminDashboardWidgetProps,
} from "@/lib/plugin";

import { NotesWidget } from "@/views/admin/views/core/dashboard/widgets/notes/notes-widget";
import { SendNotificationAction } from "@/views/admin/views/core/dashboard/widgets/send-notification/send-notification";
import { SendNotificationSettings } from "@/views/admin/views/core/dashboard/widgets/send-notification/send-notification-settings";

import { useAdminUser } from "../permissions";

const SendNotificationBrowserWidget = ({
  settings,
}: AdminDashboardWidgetProps) => {
  const user = useAdminUser();
  if (!user) return null;

  return (
    <SendNotificationAction
      defaultTitle={
        typeof settings.defaultTitle === "string" ? settings.defaultTitle : ""
      }
      defaultUserId={user.id}
    />
  );
};

export const coreDashboardBrowserWidgets: AdminDashboardWidget[] = [
  {
    id: "notes",
    component: NotesWidget,
    icon: <NotebookPenIcon />,
    defaultSpan: 2,
    defaultRows: 2,
    defaultEnabled: true,
  },
  {
    id: "send-notification",
    component: SendNotificationBrowserWidget,
    settingsComponent: SendNotificationSettings,
    icon: <SendIcon />,
    defaultSpan: 2,
    defaultRows: 1,
    minSpan: 2,
    defaultEnabled: true,
    allowMultiple: true,
  },
];
