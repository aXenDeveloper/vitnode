import { useRouterState } from "@tanstack/react-router";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { hasStaffPermission } from "@/api/lib/staff-permission";
import { PageTitle } from "@/components/ui/page-title";
import { debugHealth } from "@/views/admin/views/core/debug/health/health";
import { DebugNav } from "@/views/admin/views/core/debug/nav/debug-nav";

import type { AdminDebugLayoutData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import { useAdminPermissions } from "../permissions";
import { useDebugSources } from "./query";
import { ADMIN_DEBUG_NAMESPACES } from "./route";
import { debugTabFromPath } from "./route-search";
import { visibleDebugTabs } from "./tabs";

export const AdminDebugLayoutContent = ({
  children,
  description,
  title,
}: Pick<AdminDebugLayoutData, "description" | "title"> & {
  children: React.ReactNode;
}) => {
  const permissions = useAdminPermissions();
  const tabs = visibleDebugTabs((args: PermissionsStaffArgs) =>
    hasStaffPermission(permissions, args),
  );
  const tab = useRouterState({
    select: state => debugTabFromPath(state.location.pathname),
  });
  const health = debugHealth(useDebugSources());

  return (
    <RouteMessages namespaces={ADMIN_DEBUG_NAMESPACES}>
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <PageTitle className="mb-0" desc={description} h1={title} />

        <div className="grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)] lg:grid-cols-[16rem_minmax(0,1fr)]">
          <DebugNav active={tab} health={health} tabs={tabs} />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </RouteMessages>
  );
};
