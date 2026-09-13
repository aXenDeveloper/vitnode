import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { LogoVitNode } from "@/components/logo-vitnode";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";

export const SidebarAdminContent = ({
  children,
  LinkComponent,
  userBar,
}: {
  children: React.ReactNode;
  LinkComponent: AuthLinkComponent;
  userBar?: React.ReactNode;
}) => (
  <Sidebar variant="floating">
    <SidebarHeader className="flex h-16 flex-row items-center gap-2 border-b">
      <LinkComponent className="px-2" href="/admin/core">
        <LogoVitNode className="size-8" small />
      </LinkComponent>
    </SidebarHeader>

    <SidebarContent>{children}</SidebarContent>

    <SidebarFooter className="border-t">{userBar}</SidebarFooter>
  </Sidebar>
);
