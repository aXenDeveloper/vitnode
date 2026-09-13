import { Link } from "@tanstack/react-router";

import { LogoVitNode } from "@/components/logo-vitnode";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";

export const SidebarAdminContent = ({
  children,
  userBar,
}: {
  children: React.ReactNode;
  userBar?: React.ReactNode;
}) => (
  <Sidebar variant="floating">
    <SidebarHeader className="flex h-16 flex-row items-center gap-2 border-b">
      <Link className="px-2" to="/admin/core">
        <LogoVitNode className="size-8" small />
      </Link>
    </SidebarHeader>

    <SidebarContent>{children}</SidebarContent>

    <SidebarFooter className="border-t">{userBar}</SidebarFooter>
  </Sidebar>
);
