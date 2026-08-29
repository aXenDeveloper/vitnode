import { BugIcon } from "lucide-react";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";
import type { StaffPermissionSet } from "@/api/lib/permission-staff";
import type { AdminNavTranslator } from "@/views/admin/layouts/sidebar/nav/nav-model";

import { hasStaffPermission } from "@/api/lib/staff-permission";
import { CONFIG_PLUGIN } from "@/config";

import type { AdminSearchNavItem } from "./flatten-nav";

import { buildSearchText } from "./flatten-nav";

/**
 * A screen the command palette offers that the sidebar does not.
 *
 * The palette is otherwise a flattening of the navigation, and deliberately so -
 * an entry can only be found if it survived the permission filter. These are the
 * exceptions: real pages, reachable by URL, that were kept out of the sidebar to
 * keep it short. They are the reason the palette needs its *own* permission
 * check rather than inheriting one, and each carries the tuple it is gated on.
 */
export interface AdminSearchOnlyPage {
  href: string;
  icon: React.ReactNode;
  /** Core's own plugin id is implied; only the module and permission vary. */
  permission: Omit<PermissionsStaffArgs, "plugin">;
  titleKey: string;
}

/**
 * The debug screen, and for now only it.
 *
 * Reached from the user menu, which gates it on the same tuple - so the two
 * controls that lead there cannot disagree about who may see it.
 */
export const ADMIN_SEARCH_ONLY_PAGES: AdminSearchOnlyPage[] = [
  {
    href: "/admin/core/debug",
    icon: <BugIcon />,
    permission: { module: "debug", permission: "can_view" },
    titleKey: "admin.global.nav.user_bar.debug",
  },
];

/**
 * The search-only pages this admin may open, as palette items.
 *
 * Pure, and given the permission set rather than reading one: the Next.js
 * AdminCP resolves it per request on the server and a TanStack host has it in
 * hand from the admin session query, and neither spelling belongs in a rule that
 * is really `hasStaffPermission` over a short list.
 *
 * Grouped under core's own heading, so a debug result sits where a reader
 * expects rather than in a group of its own.
 */
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
        plugin: CONFIG_PLUGIN.pluginId,
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
