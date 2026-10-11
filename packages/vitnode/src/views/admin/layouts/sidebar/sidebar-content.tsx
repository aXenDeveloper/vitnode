import { Link } from "@tanstack/react-router";

import { LogoVitNode } from "@/components/logo-vitnode";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";

import { AdminSidebarToggle } from "./sidebar-toggle";

export const SidebarAdminContent = ({
  children,
  userBar,
}: {
  children: React.ReactNode;
  userBar?: React.ReactNode;
}) => (
  <Sidebar collapsible="icon" variant="inset">
    <SidebarHeader className="flex h-16 flex-row items-center justify-between gap-0 border-b">
      <Link
        className="flex w-34 max-w-full overflow-hidden rounded-md"
        dir="ltr"
        to="/admin/core"
      >
        <LogoVitNode
          className="h-8 w-32 shrink-0 translate-x-2 transition-transform duration-200 ease-in-out group-data-[collapsible=icon]:translate-x-0 motion-reduce:transition-none"
          idPrefix="vitnode-admin-logo"
          wordmarkClassName="ease-fluid transition-opacity delay-75 duration-200 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:delay-0 group-data-[collapsible=icon]:duration-150 motion-reduce:transition-none"
        />
      </Link>

      <div className="flex w-7 shrink-0 justify-end transition-[width] duration-200 ease-in-out group-data-[collapsible=icon]:w-0 motion-reduce:transition-none">
        <div className="ease-fluid shrink-0 transition-[opacity,visibility] delay-100 duration-150 group-data-[collapsible=icon]:invisible group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:delay-0 group-data-[collapsible=icon]:duration-100 motion-reduce:transition-none">
          <AdminSidebarToggle placement="sidebar" />
        </div>
      </div>
    </SidebarHeader>

    <SidebarContent>{children}</SidebarContent>

    <SidebarFooter className="border-t">{userBar}</SidebarFooter>
  </Sidebar>
);
