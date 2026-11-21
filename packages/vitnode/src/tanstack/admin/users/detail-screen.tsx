import {
  useInfiniteQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";
import type { SearchTimelineOwner } from "@/views/search/types";

import {
  useAdminStaffPermission,
  useAdminStaffPermissions,
} from "@/components/staff-permission/provider";
import { AiUserOverrideCardContent } from "@/views/admin/views/core/ai/access/user-override-card-content";
import { ADMIN_AI_PERMISSIONS } from "@/views/admin/views/core/ai/ai-permissions";
import { isAdminMutationError } from "@/views/admin/views/core/shared/admin-mutation";
import { ADMIN_USER_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";
import {
  cancelAdminAccountDeletion,
  deleteAdminUser,
  retryAccountDeletion,
} from "@/views/admin/views/core/users/deletions/deletions-mutations";
import { ACCOUNT_DELETIONS_QUERY_ROOT } from "@/views/admin/views/core/users/deletions/deletions-query";
import { UserConnectedAccountsCard } from "@/views/admin/views/core/users/detail/user-connected-accounts";
import {
  UserDeleteCard,
  UserDeletionNotice,
} from "@/views/admin/views/core/users/detail/user-delete-card";
import { UserDetailContent } from "@/views/admin/views/core/users/detail/user-detail-content";
import { UserDevicesCard } from "@/views/admin/views/core/users/detail/user-devices";
import { UserNotificationsPanel } from "@/views/admin/views/core/users/detail/user-notifications";
import { UserPresenceCard } from "@/views/admin/views/core/users/detail/user-presence";
import { canEditAdminUser } from "@/views/admin/views/core/users/detail/user-query";
import { UserSecurityPanel } from "@/views/admin/views/core/users/detail/user-security";
import { adminUserTimelineQueryOptions } from "@/views/admin/views/core/users/detail/user-timeline-query";
import { searchAdminRolesInBrowser } from "@/views/admin/views/core/users/roles/roles-query";
import { SearchFeedList } from "@/views/search/search-feed-content";

import type { AdminUserRouteData } from "./detail-route";

import { RouteMessages } from "../../i18n/route-messages";
import { adminAiUserOverrideQuery, useAdminAiMutations } from "../ai/query";
import { ADMIN_USER_NAMESPACES } from "./detail-route";
import {
  adminUserQuery,
  invalidateAdminUsers,
  useAdminUserMutations,
} from "./query";

export type AdminUserRouteProps = AdminUserRouteData;

const UserTimeline = ({
  adminUserId,
  locale,
  owner,
}: {
  adminUserId: AdminIdentity;
  locale: string;
  owner: SearchTimelineOwner;
}) => {
  const query = useInfiniteQuery(
    adminUserTimelineQueryOptions({ adminUserId, locale, userId: owner.id }),
  );

  return <SearchFeedList owner={owner} query={query} variant="timeline" />;
};

const UserAiAccess = ({
  adminUserId,
  userId,
}: {
  adminUserId: AdminIdentity;
  userId: number;
}) => {
  const { data } = useSuspenseQuery(
    adminAiUserOverrideQuery({ adminUserId, userId }),
  );
  const { deleteUserOverride, updateUserOverride } = useAdminAiMutations();
  const canManage = useAdminStaffPermission(ADMIN_AI_PERMISSIONS.manage);

  return (
    <AiUserOverrideCardContent
      canManage={canManage}
      onDelete={deleteUserOverride}
      onSave={updateUserOverride}
      override={data.override}
      userId={userId}
    />
  );
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
  const canViewAi = useAdminStaffPermission(ADMIN_AI_PERMISSIONS.view);
  const hasDeletePermission = useAdminStaffPermission(
    ADMIN_USER_PERMISSIONS.delete,
  );
  const canDelete = canEdit && hasDeletePermission;
  const canManageDeletion = canDelete && adminUserId !== user.id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const refreshAfterDeletion = async () => {
    await Promise.all([
      invalidateAdminUsers(queryClient, adminUserId),
      queryClient.invalidateQueries({
        queryKey: ACCOUNT_DELETIONS_QUERY_ROOT,
      }),
    ]);
  };
  const leaveErasedUser = async () => {
    await navigate({ to: "/admin/core/users" });
    await refreshAfterDeletion();
  };

  return (
    <div className="p-4 md:p-6">
      <UserDetailContent
        aiAccess={
          canViewAi ? (
            <React.Suspense fallback={null}>
              <UserAiAccess adminUserId={adminUserId} userId={user.id} />
            </React.Suspense>
          ) : null
        }
        canEdit={canEdit}
        connectedAccounts={
          <UserConnectedAccountsCard
            adminUserId={adminUserId}
            canEdit={canEdit}
            user={user}
          />
        }
        deleteAccount={
          canManageDeletion ? (
            <UserDeleteCard
              onDelete={async ({ immediately }) => {
                const result = await deleteAdminUser(user.id, { immediately });
                if (!isAdminMutationError(result) && !immediately) {
                  await refreshAfterDeletion();
                }

                return result;
              }}
              onErased={leaveErasedUser}
              user={user}
            />
          ) : null
        }
        deletionNotice={
          canManageDeletion && user.pendingDeletion ? (
            <UserDeletionNotice
              onCancel={async deletionId => {
                const result = await cancelAdminAccountDeletion(deletionId);
                if (!isAdminMutationError(result)) await refreshAfterDeletion();

                return result;
              }}
              onErased={leaveErasedUser}
              onRetry={async deletionId => {
                const result = await retryAccountDeletion(deletionId);
                if (
                  !isAdminMutationError(result) &&
                  result.data.status === "failed"
                ) {
                  await refreshAfterDeletion();
                }

                return result;
              }}
              user={user}
            />
          ) : null
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
        presence={
          <UserPresenceCard adminUserId={adminUserId} userId={user.id} />
        }
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
            owner={user}
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
