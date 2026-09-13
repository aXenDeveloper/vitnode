import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
} from "@/components/ui/sidebar";

import type { NavAdminParent } from "./nav-model";

import { ItemNavAdminContent } from "./item-content";

export const NavSidebarAdminContent = ({
  nav,
  pathname,
}: {
  nav: NavAdminParent[];
  pathname: string;
}) =>
  nav.map(parent => (
    <SidebarGroup key={parent.id}>
      <SidebarGroupLabel>{parent.title}</SidebarGroupLabel>
      <SidebarMenu>
        {parent.items.map(item => (
          <ItemNavAdminContent key={item.href} {...item} pathname={pathname} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  ));
