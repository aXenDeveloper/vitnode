import { cn } from "cn";
import { ChevronRight, MenuIcon } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

import type { AdminNavItem, AdminNavSubItem } from "./nav-model";

import { AdminLink } from "../../admin-link";
import { navItemActivity } from "./nav-active";

export interface ItemNavAdminContentProps extends AdminNavItem {
  pathname: string;
}

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
  pathname,
}: ItemNavAdminContentProps) => {
  const { state, toggleSidebar } = useSidebar();
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
          render={
            <AdminLink
              href={href}
              onClick={closeOnMobile}
              {...externalProps(isOpenInNewTab)}
            />
          }
          tooltip={title}
        >
          {content}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  if (state === "collapsed" && !isMobile) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <SidebarMenuButton
            isActive={isActive || hasActiveChild}
            render={<DropdownMenuTrigger />}
            tooltip={title}
          >
            {content}
          </SidebarMenuButton>
          <DropdownMenuContent
            align="start"
            className="w-auto min-w-48"
            side="right"
            sideOffset={8}
          >
            <DropdownMenuLabel>{title}</DropdownMenuLabel>
            {items.map((item: AdminNavSubItem) => (
              <DropdownMenuItem
                className="data-current:bg-accent data-current:font-medium"
                data-current={item.href === activeChild || undefined}
                key={item.href}
                render={
                  <AdminLink
                    href={item.href}
                    {...externalProps(item.isOpenInNewTab)}
                  />
                }
              >
                {item.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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
                render={
                  <AdminLink
                    href={item.href}
                    onClick={closeOnMobile}
                    {...externalProps(item.isOpenInNewTab)}
                  />
                }
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
