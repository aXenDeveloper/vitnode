import { LogoVitNode } from '@/components/logo-vitnode';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from '@/components/ui/sidebar';
import { Link } from '@/lib/navigation';

import { NavSidebarAdmin } from './nav/nav';

export const SidebarAdmin = ({
  pluginNav,
}: React.ComponentProps<typeof NavSidebarAdmin>) => {
  return (
    <Sidebar variant="floating">
      <SidebarHeader className="flex h-16 flex-row items-center border-b">
        <Link className="px-2" href="/admin/core">
          <LogoVitNode className="size-8" small />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavSidebarAdmin pluginNav={pluginNav} />
      </SidebarContent>
    </Sidebar>
  );
};
