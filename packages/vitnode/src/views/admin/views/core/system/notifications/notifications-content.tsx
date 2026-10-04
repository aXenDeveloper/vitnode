import type { NotificationsAdminActions } from "./notifications-mutations";
import type { AdminNotificationsOverview } from "./notifications-query";

import { NotificationsDeliveriesCard } from "./deliveries-content";
import { summarizeNotificationHealth } from "./health";
import { NotificationsHealthContent } from "./health-content";
import { NotificationsMaintenanceCard } from "./maintenance-content";
import { NotificationsSettingsCard } from "./settings-form";
import { NotificationsTypesCard } from "./types-content";

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
  const summary = summarizeNotificationHealth(data);

  return (
    <div className="flex flex-col gap-8">
      <NotificationsHealthContent
        oldestPendingEventAt={data.health.oldestPendingEventAt}
        summary={summary}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <NotificationsSettingsCard
          canEdit={canEdit}
          onSave={actions.updateSettings}
          settings={data.settings}
        />
        <NotificationsMaintenanceCard
          actions={actions}
          canManage={canManage}
          emailConfigured={summary.email === "ready"}
          retentionDays={data.settings.retentionDays}
        />
      </div>

      <NotificationsTypesCard
        canEdit={canEdit}
        onUpdate={actions.updateTypePolicy}
        types={data.types}
      />

      <NotificationsDeliveriesCard
        canManage={canManage}
        onRetry={actions.retryDelivery}
      />
    </div>
  );
};
