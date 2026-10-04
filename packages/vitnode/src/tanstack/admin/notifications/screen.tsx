import { useSuspenseQuery } from "@tanstack/react-query";

import { PageTitle } from "@/components/ui/page-title";
import { CONFIG_PLUGIN } from "@/config";
import { NotificationsContent } from "@/views/admin/views/core/system/notifications/notifications-content";
import { notificationsOverviewQueryOptions } from "@/views/admin/views/core/system/notifications/notifications-query";

import type { AdminNotificationsRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import { useAdminPermission } from "../permissions";
import { useNotificationsAdminActions } from "./query";
import { ADMIN_NOTIFICATIONS_NAMESPACES, NOTIFICATIONS_MODULE } from "./route";

export const AdminNotificationsRouteContent = ({
  description,
  title,
}: AdminNotificationsRouteData) => {
  const { data } = useSuspenseQuery(notificationsOverviewQueryOptions());
  const actions = useNotificationsAdminActions();
  const canEdit = useAdminPermission({
    module: NOTIFICATIONS_MODULE,
    permission: "can_edit",
    plugin: CONFIG_PLUGIN.pluginId,
  });
  const canManage = useAdminPermission({
    module: NOTIFICATIONS_MODULE,
    permission: "can_manage",
    plugin: CONFIG_PLUGIN.pluginId,
  });

  return (
    <RouteMessages namespaces={ADMIN_NOTIFICATIONS_NAMESPACES}>
      <div className="p-6">
        <PageTitle desc={description} h1={title} />

        <NotificationsContent
          actions={actions}
          data={data}
          permissions={{ canEdit, canManage }}
        />
      </div>
    </RouteMessages>
  );
};
