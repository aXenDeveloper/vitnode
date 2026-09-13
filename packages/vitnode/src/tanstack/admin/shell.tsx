import { useRouterState } from "@tanstack/react-router";
import React from "react";

import type { AdminUserSearch } from "@/views/admin/layouts/search/search-users";
import type { AdminNavBundle } from "@/views/admin/layouts/sidebar/nav/nav-model";

import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { NavSidebarAdminContent } from "@/views/admin/layouts/sidebar/nav/nav-content";
import { SidebarAdminContent } from "@/views/admin/layouts/sidebar/sidebar-content";

import { RouteMessages } from "../i18n/route-messages";
import { RouteGuardPending } from "../pending/guard-pending";
import { useAdminBreadcrumb } from "./breadcrumb";
import { adminShellNamespaces } from "./intl";
import { AdminNavProvider, useAdminNav } from "./nav";
import { AdminPermissionsProvider } from "./permissions";
import { AdminSearch } from "./search";
import { AdminUserBar } from "./user-bar";

export const AdminShellContent = ({
  children,
  languageSwitcher,
  nav,
  onNavigate,
  searchUsers,
}: {
  children: React.ReactNode;
  /** The host's language switcher, or nothing on a single-language install. */
  languageSwitcher?: React.ReactNode;
  nav?: AdminNavBundle;
  onNavigate?: (href: string) => void;
  searchUsers?: AdminUserSearch;
}) => {
  // Memoised on the bundle rather than recomputed per render: this list is the
  // `RouteMessages` query's input, and a host holds its bundle at module scope,
  // so one array identity per bundle is one provider that never re-mounts.
  const namespaces = React.useMemo(
    () => adminShellNamespaces(nav?.namespaces),
    [nav],
  );

  return (
    <RouteMessages namespaces={namespaces}>
      <AdminPermissionsProvider>
        <AdminNavProvider declarations={nav?.declarations}>
          <AdminShellFrame
            languageSwitcher={languageSwitcher}
            onNavigate={onNavigate}
            searchUsers={searchUsers}
          >
            <RouteGuardPending>{children}</RouteGuardPending>
          </AdminShellFrame>
        </AdminNavProvider>
      </AdminPermissionsProvider>
    </RouteMessages>
  );
};

const AdminShellFrame = ({
  children,
  languageSwitcher,
  onNavigate,
  searchUsers,
}: {
  children: React.ReactNode;
  languageSwitcher?: React.ReactNode;
  onNavigate?: (href: string) => void;
  searchUsers?: AdminUserSearch;
}) => {
  const nav = useAdminNav();
  const breadcrumb = useAdminBreadcrumb();

  const pathname = useRouterState({ select: state => state.location.pathname });

  return (
    <SidebarProvider>
      <SidebarAdminContent
        userBar={<AdminUserBar languageSwitcher={languageSwitcher} />}
      >
        <NavSidebarAdminContent nav={nav} pathname={pathname} />
      </SidebarAdminContent>

      <SidebarInset>
        <header className="bg-background sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1 shrink-0" />
          {breadcrumb != null && (
            <>
              <Separator
                className="mr-1 data-[orientation=vertical]:h-4"
                orientation="vertical"
              />
              <div className="min-w-0 flex-1">{breadcrumb}</div>
            </>
          )}

          <div className="ml-auto flex shrink-0 items-center justify-center gap-2 px-2">
            <AdminSearch onNavigate={onNavigate} searchUsers={searchUsers} />
          </div>
        </header>

        {children}
      </SidebarInset>
    </SidebarProvider>
  );
};
