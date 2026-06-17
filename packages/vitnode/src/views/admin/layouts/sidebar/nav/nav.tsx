import type { VitNodeConfig } from "@/vitnode.config";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
} from "@/components/ui/sidebar";

import { getAdminNav } from "./get-admin-nav";
import { ItemNavAdmin } from "./item";

export type { NavAdminParent } from "./get-admin-nav";

export const NavSidebarAdmin = async ({
  vitNodeConfig,
}: {
  vitNodeConfig: VitNodeConfig;
}) => {
  const rootItems = await getAdminNav({ vitNodeConfig });

  return rootItems.map(parent => (
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
