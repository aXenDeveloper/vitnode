import { coreStaffPermissions } from "@vitnode/api/lib/core-staff-permissions";
import {
  CogIcon,
  NotebookPenIcon,
  RefreshCwIcon,
  SendIcon,
  SparklesIcon,
  UsersRoundIcon,
} from "lucide-react";

import type {
  AdminDashboardWidget,
  AdminDashboardWidgetProps,
} from "@/lib/plugin";

import { AiUsageWidget } from "@/views/admin/views/core/dashboard/widgets/ai-usage/ai-usage-widget";
import { BackgroundJobsWidget } from "@/views/admin/views/core/dashboard/widgets/background-jobs/background-jobs-widget";
import { NewMembersWidget } from "@/views/admin/views/core/dashboard/widgets/new-members/new-members-widget";
import { NotesWidget } from "@/views/admin/views/core/dashboard/widgets/notes/notes-widget";
import { SendNotificationAction } from "@/views/admin/views/core/dashboard/widgets/send-notification/send-notification";
import { SendNotificationSettings } from "@/views/admin/views/core/dashboard/widgets/send-notification/send-notification-settings";
import { SystemUpdatesWidget } from "@/views/admin/views/core/dashboard/widgets/system-updates/system-updates-widget";

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
    id: "system-updates",
    component: SystemUpdatesWidget,
    icon: <RefreshCwIcon />,
    defaultSpan: 2,
    defaultRows: 1,
    defaultEnabled: true,
    permission: coreStaffPermissions.admin.plugins.canView,
  },
  {
    id: "new-members",
    component: NewMembersWidget,
    icon: <UsersRoundIcon />,
    defaultSpan: 2,
    defaultRows: 2,
    defaultEnabled: true,
    permission: coreStaffPermissions.admin.users.canView,
  },
  {
    id: "ai-usage",
    component: AiUsageWidget,
    icon: <SparklesIcon />,
    defaultSpan: 2,
    defaultRows: 2,
    defaultEnabled: true,
    flush: true,
    permission: coreStaffPermissions.admin.ai.canView,
  },
  {
    id: "background-jobs",
    component: BackgroundJobsWidget,
    icon: <CogIcon />,
    defaultSpan: 2,
    defaultRows: 2,
    defaultEnabled: true,
    permission: coreStaffPermissions.admin.cron.canView,
  },
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
    permission: coreStaffPermissions.admin.notifications.canManage,
  },
];
