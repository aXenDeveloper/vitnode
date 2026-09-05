"use client";

import React from "react";
import { useTranslations } from "use-intl";

import type { AdminSearchNavItem } from "@/views/admin/layouts/search/flatten-nav";
import type {
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

const CORE_ONLY_DECLARATIONS: AdminNavGroupDeclaration[] = adminNavDeclarations(
  { plugins: [] },
);

export const AdminNavProvider = ({
  children,
  declarations = CORE_ONLY_DECLARATIONS,
}: {
  children: React.ReactNode;

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

  return <AdminNavContext value={value}>{children}</AdminNavContext>;
};

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
