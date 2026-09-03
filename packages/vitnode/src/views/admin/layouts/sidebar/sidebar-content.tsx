import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { LogoVitNode } from "@/components/logo-vitnode";
import { ThemeSwitcher } from "@/components/switchers/themes/theme-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar";

export const SidebarAdminContent = ({
  children,
  languageSwitcher,
  LinkComponent,
}: {
  children: React.ReactNode;
  /** The host's own language switcher, or nothing on a single-language install. */
  languageSwitcher?: React.ReactNode;
  LinkComponent: AuthLinkComponent;
}) => (
  <Sidebar variant="floating">
    <SidebarHeader className="flex h-16 flex-row items-center gap-2 border-b">
      <LinkComponent className="mr-auto px-2" href="/admin/core">
        <LogoVitNode className="size-8" small />
      </LinkComponent>

      {languageSwitcher}
      <ThemeSwitcher />
    </SidebarHeader>

    <SidebarContent>{children}</SidebarContent>
  </Sidebar>
);
