import { Outlet, useRouterState } from "@tanstack/react-router";
import React from "react";

import type { AdminUserSearch } from "@/views/admin/layouts/search/search-users";
import type { AdminNavBundle } from "@/views/admin/layouts/sidebar/nav/nav-model";

import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavSidebarAdminContent } from "@/views/admin/layouts/sidebar/nav/nav-content";
import { SidebarAdminContent } from "@/views/admin/layouts/sidebar/sidebar-content";
import { AdminSidebarToggle } from "@/views/admin/layouts/sidebar/sidebar-toggle";

import { RouteMessages } from "../i18n/route-messages";
import { RouteGuardPending } from "../pending/guard-pending";
import { useAdminBreadcrumb } from "./breadcrumb";
import { adminShellNamespaces } from "./intl";
import { AdminNavProvider, useAdminNav } from "./nav";
import { AdminPermissionsProvider } from "./permissions";
import { AdminSearch } from "./search";
import { AdminSessionGuard } from "./session-guard";
import { readAdminSidebarOpen } from "./sidebar-state";
import { AdminUserBar } from "./user-bar";

export const AdminShellContent = ({
  nav,
  onNavigate,
  searchUsers,
}: {
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
        <AdminSessionGuard />
        <AdminNavProvider declarations={nav?.declarations}>
          <AdminShellFrame onNavigate={onNavigate} searchUsers={searchUsers}>
            <RouteGuardPending>
              <Outlet />
            </RouteGuardPending>
          </AdminShellFrame>
        </AdminNavProvider>
      </AdminPermissionsProvider>
    </RouteMessages>
  );
};

const AdminShellFrame = ({
  children,
  onNavigate,
  searchUsers,
}: {
  children: React.ReactNode;
  onNavigate?: (href: string) => void;
  searchUsers?: AdminUserSearch;
}) => {
  const nav = useAdminNav();
  const breadcrumb = useAdminBreadcrumb();

  const pathname = useRouterState({ select: state => state.location.pathname });

  const [defaultSidebarOpen] = React.useState(readAdminSidebarOpen);

  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
      <SidebarAdminContent userBar={<AdminUserBar />}>
        <NavSidebarAdminContent nav={nav} pathname={pathname} />
      </SidebarAdminContent>

      <SidebarInset className="transition-[margin] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] [--admin-aside-width:clamp(18rem,26vw,24rem)] motion-reduce:transition-none md:has-data-[admin-aside=open]:me-[calc(var(--admin-aside-width)+1rem)]">
        <header className="flex h-16 shrink-0 items-center border-b px-4">
          <TopbarSidebarToggle withSeparator={breadcrumb != null} />
          <div className="min-w-0 flex-1">{breadcrumb}</div>

          <div className="ml-auto flex shrink-0 items-center justify-center gap-2 px-2">
            <AdminSearch onNavigate={onNavigate} searchUsers={searchUsers} />
          </div>
        </header>

        {children}
      </SidebarInset>
    </SidebarProvider>
  );
};

const TopbarSidebarToggle = ({ withSeparator }: { withSeparator: boolean }) => {
  const { state } = useSidebar();

  return (
    <div
      className="group/topbar-toggle flex w-12 shrink-0 transition-[width] duration-200 ease-in-out motion-reduce:transition-none md:data-[state=expanded]:w-0"
      data-state={state}
    >
      <div className="ease-fluid flex shrink-0 items-center gap-2 transition-[opacity,visibility] delay-100 duration-150 motion-reduce:transition-none md:group-data-[state=expanded]/topbar-toggle:invisible md:group-data-[state=expanded]/topbar-toggle:opacity-0 md:group-data-[state=expanded]/topbar-toggle:delay-0 md:group-data-[state=expanded]/topbar-toggle:duration-100">
        <AdminSidebarToggle placement="topbar" />
        {withSeparator && (
          <Separator
            className="data-[orientation=vertical]:h-4"
            orientation="vertical"
          />
        )}
      </div>
    </div>
  );
};
