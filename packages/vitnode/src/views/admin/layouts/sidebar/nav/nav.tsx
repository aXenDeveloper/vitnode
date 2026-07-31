import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
} from "@/components/ui/sidebar";

import type { NavAdminParent } from "./get-admin-nav";

import { ItemNavAdmin } from "./item";

export type { NavAdminParent } from "./get-admin-nav";

export const NavSidebarAdmin = ({ nav }: { nav: NavAdminParent[] }) => {
  return nav.map(parent => (
    <SidebarGroup key={parent.title}>
      <SidebarGroupLabel>{parent.title}</SidebarGroupLabel>
      <SidebarMenu>
        {parent.items.map(item => (
          <ItemNavAdmin key={item.href} {...item} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  ));
};
