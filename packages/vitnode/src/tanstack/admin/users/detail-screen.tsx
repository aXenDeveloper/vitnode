import { useInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { useAdminStaffPermissions } from "@/components/staff-permission/provider";
import { UserConnectedAccountsCard } from "@/views/admin/views/core/users/detail/user-connected-accounts";
import { UserDetailContent } from "@/views/admin/views/core/users/detail/user-detail-content";
import { UserDevicesCard } from "@/views/admin/views/core/users/detail/user-devices";
import { UserNotificationsPanel } from "@/views/admin/views/core/users/detail/user-notifications";
import { canEditAdminUser } from "@/views/admin/views/core/users/detail/user-query";
import { UserSecurityPanel } from "@/views/admin/views/core/users/detail/user-security";
import { adminUserTimelineQueryOptions } from "@/views/admin/views/core/users/detail/user-timeline-query";
import { searchAdminRolesInBrowser } from "@/views/admin/views/core/users/roles/roles-query";
import { SearchFeedList } from "@/views/search/search-feed-content";

import type { AdminUserRouteData } from "./detail-route";

import { RouteMessages } from "../../i18n/route-messages";
import { ADMIN_USER_NAMESPACES } from "./detail-route";
import { adminUserQuery, useAdminUserMutations } from "./query";

export type AdminUserRouteProps = AdminUserRouteData;

const UserTimeline = ({
  adminUserId,
  locale,
  userId,
}: {
  adminUserId: AdminIdentity;
  locale: string;
  userId: number;
}) => {
  const query = useInfiniteQuery(
    adminUserTimelineQueryOptions({ adminUserId, locale, userId }),
  );

  return <SearchFeedList query={query} variant="timeline" />;
};

const AdminUserScreen = ({ adminUserId, id, locale }: AdminUserRouteProps) => {
  const t = useTranslations("admin.user.show.images");
  const { data: user } = useSuspenseQuery(adminUserQuery({ adminUserId, id }));
  const {
    onRemoveImage,
    onUpdate,
    onUpdateRoles,
    onUploadImage,
    onVerifyEmail,
  } = useAdminUserMutations();
  const permissions = useAdminStaffPermissions();
  const canEdit = canEditAdminUser(permissions, user);

  return (
    <div className="p-4 md:p-6">
      <UserDetailContent
        canEdit={canEdit}
        connectedAccounts={
          <UserConnectedAccountsCard
            adminUserId={adminUserId}
            canEdit={canEdit}
            user={user}
          />
        }
        devices={
          <UserDevicesCard
            adminUserId={adminUserId}
            canEdit={canEdit}
            user={user}
          />
        }
        notifications={
          <UserNotificationsPanel
            adminUserId={adminUserId}
            canEdit={canEdit}
            user={user}
          />
        }
        onRemoveImage={async (userId, kind) => {
          await onRemoveImage(userId, kind);
          toast.success(t(`${kind}.removed`), {
            description: t("removedDesc"),
          });
        }}
        onUpdate={onUpdate}
        onUpdateRoles={onUpdateRoles}
        onUploadImage={async (userId, kind, file) => {
          await onUploadImage(userId, kind, file);
          toast.success(t(`${kind}.uploaded`), {
            description: t("uploadedDesc"),
          });
        }}
        onVerifyEmail={onVerifyEmail}
        searchRoles={searchAdminRolesInBrowser}
        security={
          <UserSecurityPanel
            adminUserId={adminUserId}
            canEdit={canEdit}
            user={user}
          />
        }
        timeline={
          <UserTimeline
            adminUserId={adminUserId}
            locale={locale}
            userId={user.id}
          />
        }
        user={user}
      />
    </div>
  );
};

export const AdminUserRouteContent = (props: AdminUserRouteProps) => (
  <RouteMessages namespaces={ADMIN_USER_NAMESPACES}>
    <AdminUserScreen {...props} />
  </RouteMessages>
);
