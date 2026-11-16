import type { StaffPermissionSet } from "@vitnode/api/lib/permission-staff";
import type { AdminStaffPermissionRef } from "@vitnode/api/lib/staff-permissions";

import { coreStaffPermissions } from "@vitnode/api/lib/core-staff-permissions";
import { hasStaffPermission } from "@vitnode/api/lib/staff-permission";
import { staffPermissionArgs } from "@vitnode/api/lib/staff-permissions";
import { BugIcon, ClockIcon, ListTodoIcon, SearchIcon } from "lucide-react";

import type { AdminNavTranslator } from "@/views/admin/layouts/sidebar/nav/nav-model";

import type { AdminSearchNavItem } from "./flatten-nav";

import { buildSearchText } from "./flatten-nav";

export interface AdminSearchOnlyPage {
  href: string;
  icon: React.ReactNode;
  permission: AdminStaffPermissionRef;
  titleKey: string;
}

export const ADMIN_SEARCH_ONLY_PAGES: AdminSearchOnlyPage[] = [
  {
    href: "/admin/core/debug",
    icon: <BugIcon />,
    permission: coreStaffPermissions.admin.debug.canView,
    titleKey: "admin.global.nav.user_bar.debug",
  },
  {
    href: "/admin/core/debug/cron",
    icon: <ClockIcon />,
    permission: coreStaffPermissions.admin.cron.canView,
    titleKey: "admin.global.nav.debug.cron",
  },
  {
    href: "/admin/core/debug/queue",
    icon: <ListTodoIcon />,
    permission: coreStaffPermissions.admin.queue.canView,
    titleKey: "admin.global.nav.debug.queue",
  },
  {
    href: "/admin/core/debug/search",
    icon: <SearchIcon />,
    permission: coreStaffPermissions.admin.system.canView,
    titleKey: "admin.global.nav.debug.search",
  },
];

export const adminSearchOnlyItems = ({
  pages = ADMIN_SEARCH_ONLY_PAGES,
  permissions,
  t,
}: {
  pages?: AdminSearchOnlyPage[];
  permissions: StaffPermissionSet;
  t: AdminNavTranslator;
}): AdminSearchNavItem[] => {
  const groupTitle = t("admin.global.nav.core");

  return pages
    .filter(page =>
      hasStaffPermission(permissions, staffPermissionArgs(page.permission)),
    )
    .map(page => {
      const title = t(page.titleKey);

      return {
        groupTitle,
        href: page.href,
        icon: page.icon,
        searchText: buildSearchText([title, groupTitle]),
        title,
      };
    });
};
