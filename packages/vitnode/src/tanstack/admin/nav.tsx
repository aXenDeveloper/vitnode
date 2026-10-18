import React from "react";
import { useTranslations } from "use-intl";

import type { AdminSearchNavItem } from "@/views/admin/layouts/search/flatten-nav";
import type {
  AdminNavDashboardWidgets,
  AdminNavGroupDeclaration,
  AdminNavTranslator,
  NavAdminParent,
} from "@/views/admin/layouts/sidebar/nav/nav-model";

import { flattenAdminNav } from "@/views/admin/layouts/search/flatten-nav";
import { adminSearchOnlyItems } from "@/views/admin/layouts/search/search-only-pages";
import {
  adminNavDeclarations,
  resolveAdminNav,
} from "@/views/admin/layouts/sidebar/nav/nav-model";

import { useAdminPermissions } from "./permissions";

interface AdminNavValue {
  nav: NavAdminParent[];
  searchItems: AdminSearchNavItem[];
}

const AdminNavContext = React.createContext<AdminNavValue | null>(null);

const NO_DASHBOARD_WIDGETS: AdminNavDashboardWidgets[] = [];

const AdminDashboardWidgetsContext =
  React.createContext<AdminNavDashboardWidgets[]>(NO_DASHBOARD_WIDGETS);

const CORE_ONLY_DECLARATIONS: AdminNavGroupDeclaration[] = adminNavDeclarations(
  { plugins: [] },
);

export const AdminNavProvider = ({
  children,
  dashboardWidgets = NO_DASHBOARD_WIDGETS,
  declarations = CORE_ONLY_DECLARATIONS,
}: {
  children: React.ReactNode;
  /** The plugins' dashboard widgets from the app's `admin-nav.gen.ts`, for the dashboard screen. */
  dashboardWidgets?: AdminNavDashboardWidgets[];
  declarations?: AdminNavGroupDeclaration[];
}) => {
  const permissions = useAdminPermissions();

  const t = useTranslations() as unknown as AdminNavTranslator;

  const value = React.useMemo<AdminNavValue>(() => {
    const nav = resolveAdminNav({ declarations, permissions, t });

    return {
      nav,

      searchItems: [
        ...flattenAdminNav(nav),
        ...adminSearchOnlyItems({ permissions, t }),
      ],
    };
  }, [declarations, permissions, t]);

  return (
    <AdminNavContext value={value}>
      <AdminDashboardWidgetsContext value={dashboardWidgets}>
        {children}
      </AdminDashboardWidgetsContext>
    </AdminNavContext>
  );
};

/**
 * The plugins' dashboard widgets the AdminCP shell was given - each plugin's
 * `adminNav.admin.dashboard.widgets`, collected into the app's
 * `admin-nav.gen.ts`. Empty outside the shell.
 */
export const useAdminDashboardPluginWidgets = (): AdminNavDashboardWidgets[] =>
  React.use(AdminDashboardWidgetsContext);

const useAdminNavValue = (): AdminNavValue => {
  const value = React.use(AdminNavContext);

  if (value === null) {
    throw new Error(
      "useAdminNav must be rendered inside <AdminNavProvider>. The AdminCP shell mounts one.",
    );
  }

  return value;
};

export const useAdminNav = (): NavAdminParent[] => useAdminNavValue().nav;

export const useAdminSearchNavItems = (): AdminSearchNavItem[] =>
  useAdminNavValue().searchItems;
