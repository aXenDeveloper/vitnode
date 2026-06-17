import { LayoutDashboardIcon, UsersRoundIcon, WrenchIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { VitNodeConfig } from "@/vitnode.config";

import { getVitNodeConfig } from "@/vitnode.config";

import type { ItemNavAdmin } from "./item";

export interface NavAdminParent {
  id: string;
  items: React.ComponentProps<typeof ItemNavAdmin>[];
  title: string;
}

/**
 * Builds the full, already-translated admin navigation tree (core + every
 * plugin). Shared between the sidebar ({@link NavSidebarAdmin}) and the
 * breadcrumb ({@link BreadcrumbAdmin}) so labels stay consistent and
 * plugin-aware without per-route configuration.
 *
 * `vitNodeConfig` defaults to the registered app config, so framework-owned
 * route files (the copied `@breadcrumb` slots) can call it without a prop.
 */
export const getAdminNav = async ({
  vitNodeConfig = getVitNodeConfig(),
}: {
  vitNodeConfig?: VitNodeConfig;
} = {}): Promise<NavAdminParent[]> => {
  const t = await getTranslations();

  const core: NavAdminParent = {
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
          },
          {
            title: t("admin.global.nav.users.roles"),
            href: "/admin/core/users/roles",
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
        ],
      },
    ],
  };

  const pluginNav: NavAdminParent[] = vitNodeConfig.plugins
    .filter(plugin => plugin.admin?.nav)
    .map(plugin => ({
      id: plugin.pluginId,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      title: t(`${plugin.pluginId}.title`),
      items: (plugin.admin?.nav ?? []).map(item => ({
        ...item,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        title: t(`${plugin.pluginId}.admin.nav.${item.id}`),
        items:
          item.items?.map(subItem => ({
            ...subItem,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            title: t(`${plugin.pluginId}.admin.nav.${item.id}.${subItem.id}`),
          })) ?? [],
      })),
    }));

  return [core, ...pluginNav];
};
