import {
  LayoutDashboardIcon,
  ServerIcon,
  ShieldUserIcon,
  UsersRoundIcon,
  WrenchIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import type {
  PermissionsStaffArgs,
  StaffPermissionSet,
} from "@/api/lib/permission-staff";
import type { VitNodeConfig } from "@/vitnode.config";

import { hasStaffPermission } from "@/api/lib/staff-permission";
import { CONFIG_PLUGIN } from "@/config";
import { getSessionAdminApi } from "@/lib/api/get-session-admin-api";
import { getVitNodeConfig } from "@/vitnode.config";

import type { ItemNavAdmin } from "./item";

export interface NavAdminParent {
  id: string;
  items: React.ComponentProps<typeof ItemNavAdmin>[];
  title: string;
}

interface NavSubItemConfig {
  href: string;
  isOpenInNewTab?: boolean;
  permission?: PermissionsStaffArgs;
  title: string;
}

interface NavItemConfig {
  href: string;
  icon?: React.ReactNode;
  isOpenInNewTab?: boolean;
  items?: NavSubItemConfig[];
  permission?: PermissionsStaffArgs;
  title: string;
}

interface NavGroupConfig {
  id: string;
  items: NavItemConfig[];
  title: string;
}

const isAllowed = (
  permission: PermissionsStaffArgs | undefined,
  set: StaffPermissionSet,
): boolean => !permission || hasStaffPermission(set, permission);

const filterNavItems = (
  items: NavItemConfig[],
  set: StaffPermissionSet,
): React.ComponentProps<typeof ItemNavAdmin>[] => {
  const result: React.ComponentProps<typeof ItemNavAdmin>[] = [];

  for (const item of items) {
    if (!isAllowed(item.permission, set)) continue;

    if (item.items && item.items.length > 0) {
      const visibleSubItems = item.items.filter(subItem =>
        isAllowed(subItem.permission, set),
      );
      if (visibleSubItems.length === 0) continue;

      result.push({
        href: item.href,
        icon: item.icon,
        isOpenInNewTab: item.isOpenInNewTab,
        title: item.title,
        items: visibleSubItems.map(subItem => ({
          href: subItem.href,
          isOpenInNewTab: subItem.isOpenInNewTab,
          title: subItem.title,
        })),
      });
    } else {
      result.push({
        href: item.href,
        icon: item.icon,
        isOpenInNewTab: item.isOpenInNewTab,
        title: item.title,
      });
    }
  }

  return result;
};

export const getAdminNav = async ({
  vitNodeConfig = getVitNodeConfig(),
}: {
  vitNodeConfig?: VitNodeConfig;
} = {}): Promise<NavAdminParent[]> => {
  const t = await getTranslations();
  const session = await getSessionAdminApi();
  const permissions: StaffPermissionSet = session?.permissions ?? {
    root: false,
    permissions: [],
  };

  const core: NavGroupConfig = {
    id: "core",
    title: t("admin.global.nav.core"),
    items: [
      {
        href: "/admin/core/",
        icon: <LayoutDashboardIcon />,
        title: t("admin.global.nav.dashboard"),
      },
      {
        title: "test",
        icon: <LayoutDashboardIcon />,
        href: "/admin/core/test",
      },
      {
        href: "/admin/core/users",
        title: t("admin.global.nav.users.title"),
        icon: <UsersRoundIcon />,
        items: [
          {
            title: t("admin.global.nav.users.list"),
            href: "/admin/core/users",
            permission: {
              plugin: CONFIG_PLUGIN.pluginId,
              module: "users",
              permission: "can_view",
            },
          },
          {
            title: t("admin.global.nav.users.roles"),
            href: "/admin/core/users/roles",
          },
        ],
      },
      {
        href: "/admin/core/staff",
        title: t("admin.global.nav.staff.title"),
        icon: <ShieldUserIcon />,
        items: [
          {
            title: t("admin.global.nav.staff.moderators"),
            href: "/admin/core/staff/moderators",
            permission: {
              plugin: CONFIG_PLUGIN.pluginId,
              module: "staff_moderators",
              permission: "can_view",
            },
          },
          {
            title: t("admin.global.nav.staff.admins"),
            href: "/admin/core/staff/admins",
            permission: {
              plugin: CONFIG_PLUGIN.pluginId,
              module: "staff_admins",
              permission: "can_view",
            },
          },
        ],
      },
      {
        href: "/admin/core/system",
        title: t("admin.global.nav.system.title"),
        icon: <ServerIcon />,
        items: [
          {
            title: t("admin.global.nav.system.integrations"),
            href: "/admin/core/system/integrations",
            permission: {
              plugin: CONFIG_PLUGIN.pluginId,
              module: "system",
              permission: "can_view",
            },
          },
          {
            title: t("admin.global.nav.system.files"),
            href: "/admin/core/system/files",
            permission: {
              plugin: CONFIG_PLUGIN.pluginId,
              module: "files",
              permission: "can_view",
            },
          },
        ],
      },
      {
        href: "/admin/core/advanced",
        title: t("admin.global.nav.advanced.title"),
        icon: <WrenchIcon />,
        items: [
          {
            title: t("admin.global.nav.advanced.cron"),
            href: "/admin/core/advanced/cron",
          },
          {
            title: t("admin.global.nav.advanced.queue"),
            href: "/admin/core/advanced/queue",
            permission: {
              plugin: CONFIG_PLUGIN.pluginId,
              module: "queue",
              permission: "can_view",
            },
          },
        ],
      },
    ],
  };

  const pluginNav: NavGroupConfig[] = vitNodeConfig.plugins
    .filter(plugin => plugin.admin?.nav)
    .map(plugin => ({
      id: plugin.pluginId,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      title: t(`${plugin.pluginId}.title`),
      items: (plugin.admin?.nav ?? []).map(item => ({
        href: item.href,
        icon: item.icon,
        isOpenInNewTab: item.isOpenInNewTab,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        title: t(`${plugin.pluginId}.admin.nav.${item.id}`),
        permission: item.permission
          ? { plugin: plugin.pluginId, ...item.permission }
          : undefined,
        items:
          item.items?.map(subItem => ({
            href: subItem.href,
            isOpenInNewTab: subItem.isOpenInNewTab,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            title: t(`${plugin.pluginId}.admin.nav.${item.id}.${subItem.id}`),
            permission: subItem.permission
              ? { plugin: plugin.pluginId, ...subItem.permission }
              : undefined,
          })) ?? [],
      })),
    }));

  return [core, ...pluginNav]
    .map(group => ({
      id: group.id,
      title: group.title,
      items: filterNavItems(group.items, permissions),
    }))
    .filter(group => group.items.length > 0);
};
