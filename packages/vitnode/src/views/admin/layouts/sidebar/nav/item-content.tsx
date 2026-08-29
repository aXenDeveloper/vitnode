"use client";

import { ChevronRight, MenuIcon } from "lucide-react";
import React, { useEffect, useState } from "react";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import type { AdminNavItem, AdminNavSubItem } from "./nav-model";

import { adminLinkFor } from "../../admin-link";
import { navItemActivity } from "./nav-active";

/**
 * One sidebar entry, with the two things it cannot resolve for itself handed in.
 *
 * `pathname` rather than a hook, and `LinkComponent` rather than an import: the
 * same seam `SettingsNavContent` and `HeaderContent` already draw, for the same
 * reason. `usePathname` and a locale-aware `Link` come from `next-intl` in the
 * Next.js AdminCP and from the router in TanStack Start, and importing either
 * here would make the whole sidebar Next-only.
 *
 * The pathname is **internal** - `/admin` is outside the localized URL space in
 * both applications, so there is no prefix to strip and nothing here localizes
 * an href either. `LinkComponent` does that, once.
 *
 * ## Why `LinkComponent` is required rather than defaulting to `<a>`
 *
 * A missing wrapper would degrade silently into a full document reload on every
 * sidebar click - which during the migration is *sometimes* the right answer and
 * never the right default. `apps/web` passes one that asks its route tree per
 * href, so a nav entry pointing at a screen the Next.js app still serves becomes
 * a document load while `/admin/core` stays a client navigation.
 */
export interface ItemNavAdminContentProps extends AdminNavItem {
  LinkComponent: AuthLinkComponent;
  pathname: string;
}

/**
 * An entry's target attributes, or nothing.
 *
 * `rel` travels with `target` rather than being set independently: a
 * `_blank` link without `noopener` hands the opened page a live `window.opener`
 * reference back into the AdminCP, and a plugin's declared nav entry may point
 * at any external URL at all.
 */
const externalProps = (isOpenInNewTab?: boolean) =>
  isOpenInNewTab
    ? { rel: "noopener noreferrer", target: "_blank" }
    : { rel: undefined, target: undefined };

export const ItemNavAdminContent = ({
  href,
  title,
  icon,
  items = [],
  isOpenInNewTab,
  LinkComponent,
  pathname,
}: ItemNavAdminContentProps) => {
  const { toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();
  const { activeChild, hasActiveChild, isActive } = navItemActivity(pathname, {
    href,
    items,
  });

  const [open, setOpen] = useState(hasActiveChild);

  useEffect(() => {
    if (hasActiveChild) {
      // eslint-disable-next-line react-hooks/set-state-in-effect, @eslint-react/set-state-in-effect
      setOpen(true);
    }
  }, [hasActiveChild]);

  /**
   * Closing the drawer after a tap, on a narrow screen only.
   *
   * The sidebar is a persistent rail on a desktop and a sheet over the page on a
   * phone, so navigating without this leaves the visitor looking at the menu
   * they just used rather than the page they asked for.
   */
  const closeOnMobile = () => {
    if (isMobile) toggleSidebar();
  };

  const content = (
    <>
      {icon ?? <MenuIcon />}
      <span>{title}</span>
    </>
  );

  if (!items.length) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={isActive}
          render={React.createElement(adminLinkFor(href, LinkComponent), {
            href,
            onClick: closeOnMobile,
            ...externalProps(isOpenInNewTab),
          })}
          tooltip={title}
        >
          {content}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible
      onOpenChange={setOpen}
      open={open}
      render={<SidebarMenuItem />}
    >
      <CollapsibleTrigger
        className="group/collapsible"
        render={
          <SidebarMenuButton
            isActive={isActive || hasActiveChild}
            tooltip={title}
          />
        }
      >
        {content}
        <ChevronRight className="ml-auto transition-transform duration-200 group-data-panel-open/collapsible:rotate-90" />
      </CollapsibleTrigger>

      <CollapsibleContent
        className={cn(
          "text-popover-foreground h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out outline-none data-ending-style:h-0 data-starting-style:h-0",
        )}
      >
        <SidebarMenuSub>
          {items.map((item: AdminNavSubItem) => (
            <SidebarMenuSubItem key={item.href}>
              <SidebarMenuSubButton
                isActive={item.href === activeChild}
                render={React.createElement(
                  adminLinkFor(item.href, LinkComponent),
                  {
                    href: item.href,
                    onClick: closeOnMobile,
                    ...externalProps(item.isOpenInNewTab),
                  },
                )}
              >
                {item.title}
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
};
