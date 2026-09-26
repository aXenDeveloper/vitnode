import { useInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { useAdminStaffPermissions } from "@/components/staff-permission/provider";
import { UserDetailContent } from "@/views/admin/views/core/users/detail/user-detail-content";
import { canEditAdminUser } from "@/views/admin/views/core/users/detail/user-query";
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
  const { onRemoveImage, onUpdate, onUpdateRoles, onUploadImage } =
    useAdminUserMutations();
  const permissions = useAdminStaffPermissions();

  return (
    <div className="p-4">
      <UserDetailContent
        canEdit={canEditAdminUser(permissions, { isAdmin: user.isAdmin })}
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
        searchRoles={searchAdminRolesInBrowser}
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
