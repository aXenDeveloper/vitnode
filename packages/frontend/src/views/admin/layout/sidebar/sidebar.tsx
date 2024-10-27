import { LogoVitNode } from '@/components/logo-vitnode';
import { LanguageSwitcher } from '@/components/switchers/language-switcher';
import { ThemeSwitcher } from '@/components/switchers/theme-switcher';
import { Sidebar } from '@/components/ui/sidebar';
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar-server';
import { Link } from '@/navigation';

import { SearchSidebarAdmin } from './search/search';
import { UserBarSidebarAdmin } from './user-bar';

export const SidebarAdmin = () => {
  return (
    <Sidebar variant="inset">
      <SidebarHeader className="flex-row items-center justify-between">
        <Link href="/admin/core/dashboard">
          <LogoVitNode className="h-8" small />
        </Link>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeSwitcher />

          <UserBarSidebarAdmin />
        </div>
      </SidebarHeader>
      <SearchSidebarAdmin />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>test</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/admin/core/dashboard">Dashboard</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};
