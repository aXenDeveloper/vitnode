import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";

import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { PageTitle } from "@/components/ui/page-title";
import { AiAccessContent } from "@/views/admin/views/core/ai/access/access-content";
import { ADMIN_AI_PERMISSIONS } from "@/views/admin/views/core/ai/ai-permissions";

import type { AdminAiRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import { readAdminUserSearch } from "../user-search";
import {
  adminAiAccessQuery,
  adminAiActionsQuery,
  useAdminAiMutations,
} from "./query";
import { ADMIN_AI_NAMESPACES } from "./route";

export const AdminAiAccessRouteContent = ({
  adminUserId,
  description,
  title,
}: AdminAiRouteData) => {
  const { data } = useSuspenseQuery(adminAiAccessQuery({ adminUserId }));
  const { data: actionsData } = useSuspenseQuery(
    adminAiActionsQuery({ adminUserId }),
  );
  const { deleteUserOverride, updateRoleAccess, updateUserOverride } =
    useAdminAiMutations();
  const canManage = useAdminStaffPermission(ADMIN_AI_PERMISSIONS.manage);

  // A permission is named by what its actions do; its key is the fallback.
  const permissionNames = React.useMemo(() => {
    const descriptions = new Map(
      actionsData.actions.map(action => [action.key, action.description]),
    );

    return new Map(
      data.permissions.map(permission => {
        const names = permission.actions
          .map(key => descriptions.get(key))
          .filter((name): name is string => Boolean(name));

        return [
          permission.key,
          names.length > 0 ? names.join(", ") : permission.key,
        ];
      }),
    );
  }, [actionsData.actions, data.permissions]);

  return (
    <RouteMessages namespaces={ADMIN_AI_NAMESPACES}>
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <PageTitle className="mb-0" desc={description} h1={title} />

        <AiAccessContent
          canManage={canManage}
          data={data}
          describePermission={key => permissionNames.get(key) ?? key}
          onDeleteUserOverride={deleteUserOverride}
          onSaveRole={updateRoleAccess}
          onSaveUserOverride={updateUserOverride}
          searchUsers={readAdminUserSearch}
        />
      </div>
    </RouteMessages>
  );
};
