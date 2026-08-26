import type { VitNodeConfig } from "@/vitnode.config";

import { LogoVitNode } from "@/components/logo-vitnode";
import { LanguageSwitcher } from "@/components/switchers/langs/language-switcher";
import { ThemeSwitcher } from "@/components/switchers/themes/theme-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Link } from "@/lib/navigation";

export const SidebarAdmin = ({
  children,
  vitNodeConfig,
}: {
  children: React.ReactNode;
  vitNodeConfig: VitNodeConfig;
}) => {
  return (
    <Sidebar variant="floating">
      <SidebarHeader className="flex h-16 flex-row items-center gap-2 border-b">
        <Link className="mr-auto px-2" href="/admin/core">
          <LogoVitNode className="size-8" small />
        </Link>

        {vitNodeConfig.i18n.locales.length > 1 && (
          <LanguageSwitcher locales={vitNodeConfig.i18n.locales} />
        )}
        <ThemeSwitcher />
      </SidebarHeader>

      <SidebarContent>{children}</SidebarContent>
    </Sidebar>
  );
};
