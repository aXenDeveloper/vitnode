import { PauseIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import type { NotificationsAdminActions } from "./notifications-mutations";
import type { AdminNotificationsOverview } from "./notifications-query";

import { NotificationsActivity } from "./activity-content";
import { NotificationsTypesSection } from "./types-content";

export interface NotificationsAdminPermissions {
  canEdit: boolean;
  canManage: boolean;
}

export const NotificationsContent = ({
  actions,
  data,
  permissions: { canEdit, canManage },
}: {
  actions: NotificationsAdminActions;
  data: AdminNotificationsOverview;
  permissions: NotificationsAdminPermissions;
}) => {
  const t = useTranslations("admin.system.notifications.paused");

  return (
    <div className="flex flex-col gap-8">
      {data.settings.paused ? (
        <Alert variant="warning">
          <PauseIcon aria-hidden />
          <AlertTitle>{t("title")}</AlertTitle>
          <AlertDescription>{t("desc")}</AlertDescription>
        </Alert>
      ) : null}

      <NotificationsActivity />

      <NotificationsTypesSection
        actions={actions}
        canEdit={canEdit}
        canManage={canManage}
        customizedMembers={data.counts.customizedMembers}
        types={data.types}
      />
    </div>
  );
};
