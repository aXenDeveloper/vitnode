"use client";

import { useRouterState } from "@tanstack/react-router";
import React from "react";

import type { AdminUserSearch } from "@/views/admin/layouts/search/search-users";
import type { AdminNavBundle } from "@/views/admin/layouts/sidebar/nav/nav-model";
import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { NavSidebarAdminContent } from "@/views/admin/layouts/sidebar/nav/nav-content";
import { SidebarAdminContent } from "@/views/admin/layouts/sidebar/sidebar-content";

import { RouteMessages } from "../i18n/route-messages";
import { RouterLink } from "../layout/router-link";
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
  LinkComponent = RouterLink,
  nav,
  onNavigate,
  searchUsers,
}: {
  children: React.ReactNode;
  /** The host's language switcher, or nothing on a single-language install. */
  languageSwitcher?: React.ReactNode;
  LinkComponent?: AuthLinkComponent;

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
            LinkComponent={LinkComponent}
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
  LinkComponent,
  onNavigate,
  searchUsers,
}: {
  children: React.ReactNode;
  languageSwitcher?: React.ReactNode;
  LinkComponent: AuthLinkComponent;
  onNavigate?: (href: string) => void;
  searchUsers?: AdminUserSearch;
}) => {
  const nav = useAdminNav();
  const breadcrumb = useAdminBreadcrumb();

  const pathname = useRouterState({ select: state => state.location.pathname });

  return (
    <SidebarProvider>
      <SidebarAdminContent
        languageSwitcher={languageSwitcher}
        LinkComponent={LinkComponent}
      >
        <NavSidebarAdminContent
          LinkComponent={LinkComponent}
          nav={nav}
          pathname={pathname}
        />
      </SidebarAdminContent>

      <SidebarInset>
        <header className="bg-background sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1 shrink-0" />
          {breadcrumb != null && (
            <>
              <Separator className="mr-1 h-4 shrink-0" orientation="vertical" />
              <div className="min-w-0 flex-1">{breadcrumb}</div>
            </>
          )}

          <div className="ml-auto flex shrink-0 items-center justify-center gap-2 px-2">
            <AdminSearch
              LinkComponent={LinkComponent}
              onNavigate={onNavigate}
              searchUsers={searchUsers}
            />
            <AdminUserBar LinkComponent={LinkComponent} />
          </div>
        </header>

        {children}
      </SidebarInset>
    </SidebarProvider>
  );
};
