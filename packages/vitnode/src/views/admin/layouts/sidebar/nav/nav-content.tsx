import type { AuthLinkComponent } from "@/views/auth/auth-link";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
} from "@/components/ui/sidebar";

import type { NavAdminParent } from "./nav-model";

import { ItemNavAdminContent } from "./item-content";

/**
 * The AdminCP sidebar's groups and entries, given a navigation to render.
 *
 * Deliberately dumb: it decides nothing about *what* is in the navigation. The
 * groups arrive already filtered by `buildAdminNav`, which is the only place a
 * permission is ever consulted - so a group reaching here is a group this admin
 * may see, and this component never has to ask a second time.
 *
 * `pathname` and `LinkComponent` pass straight through to each entry. See
 * `ItemNavAdminContent` for why they are props rather than hooks.
 */
export const NavSidebarAdminContent = ({
  LinkComponent,
  nav,
  pathname,
}: {
  LinkComponent: AuthLinkComponent;
  nav: NavAdminParent[];
  pathname: string;
}) =>
  nav.map(parent => (
    <SidebarGroup key={parent.id}>
      <SidebarGroupLabel>{parent.title}</SidebarGroupLabel>
      <SidebarMenu>
        {parent.items.map(item => (
          <ItemNavAdminContent
            key={item.href}
            {...item}
            LinkComponent={LinkComponent}
            pathname={pathname}
          />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  ));
