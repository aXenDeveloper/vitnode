import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";

import { AdminStaffPermissionGate } from "@/components/staff-permission/provider";
import { HeaderContent } from "@/components/ui/header-content";
import {
  CreateNavigationAction,
  NavigationAdminListContent,
} from "@/views/admin/views/core/navigation/navigation-list-content";
import { ADMIN_NAVIGATION_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";

import type { AdminNavigationRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import {
  adminNavigationPresetsQuery,
  adminNavigationQuery,
  useAdminNavigationMutations,
} from "./query";
import { ADMIN_NAVIGATION_NAMESPACES } from "./route";

export const AdminNavigationRouteContent = ({
  adminUserId,
  description,
  namespaces,
  title,
}: AdminNavigationRouteData) => {
  const { data } = useSuspenseQuery(adminNavigationQuery({ adminUserId }));
  const { data: presetsData } = useSuspenseQuery(
    adminNavigationPresetsQuery({ adminUserId }),
  );
  const { onDelete, onReorder, onSave } = useAdminNavigationMutations();

  const messageNamespaces = React.useMemo(
    () => [...ADMIN_NAVIGATION_NAMESPACES, ...namespaces],
    [namespaces],
  );

  return (
    <RouteMessages namespaces={messageNamespaces}>
      <div className="p-4">
        <HeaderContent desc={description} h1={title}>
          <AdminStaffPermissionGate {...ADMIN_NAVIGATION_PERMISSIONS.create}>
            <CreateNavigationAction
              items={data.items}
              onSave={onSave}
              presets={presetsData.presets}
            />
          </AdminStaffPermissionGate>
        </HeaderContent>

        <NavigationAdminListContent
          items={data.items}
          onDelete={onDelete}
          onReorder={onReorder}
          onSave={onSave}
          presets={presetsData.presets}
        />
      </div>
    </RouteMessages>
  );
};
