import { BugIcon, ClockIcon, ListTodoIcon, SearchIcon } from "lucide-react";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";
import type { StaffPermissionSet } from "@/api/lib/permission-staff";
import type { AdminNavTranslator } from "@/views/admin/layouts/sidebar/nav/nav-model";

import { hasStaffPermission } from "@/api/lib/staff-permission";
import { manifest } from "@/manifest";

import type { AdminSearchNavItem } from "./flatten-nav";

import { buildSearchText } from "./flatten-nav";

export interface AdminSearchOnlyPage {
  href: string;
  icon: React.ReactNode;
  /** Core's own plugin id is implied; only the module and permission vary. */
  permission: Omit<PermissionsStaffArgs, "plugin">;
  titleKey: string;
}

export const ADMIN_SEARCH_ONLY_PAGES: AdminSearchOnlyPage[] = [
  {
    href: "/admin/core/debug",
    icon: <BugIcon />,
    permission: { module: "debug", permission: "can_view" },
    titleKey: "admin.global.nav.user_bar.debug",
  },
  {
    href: "/admin/core/debug/cron",
    icon: <ClockIcon />,
    permission: { module: "cron", permission: "can_view" },
    titleKey: "admin.global.nav.debug.cron",
  },
  {
    href: "/admin/core/debug/queue",
    icon: <ListTodoIcon />,
    permission: { module: "queue", permission: "can_view" },
    titleKey: "admin.global.nav.debug.queue",
  },
  {
    href: "/admin/core/debug/search",
    icon: <SearchIcon />,
    permission: { module: "system", permission: "can_view" },
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
      hasStaffPermission(permissions, {
        plugin: manifest.id,
        ...page.permission,
      }),
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
