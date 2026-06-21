"use client";

import { ChevronRight, MenuIcon } from "lucide-react";

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
import { Link, usePathname } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface ItemNavAdminProps {
  href: string;
  icon?: React.ReactNode;
  isOpenInNewTab?: boolean;
  title: string;
}

export const ItemNavAdmin = ({
  href,
  title,
  icon,
  items = [],
  isOpenInNewTab,
}: ItemNavAdminProps & {
  items?: Omit<ItemNavAdminProps, "icon">[];
}) => {
  const { toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();
  const pathname = usePathname();

  // Helper function to normalize URLs for comparison
  const normalizeUrl = (url: string) => {
    return url.endsWith("/") && url.length > 1 ? url.slice(0, -1) : url;
  };

  // Check if current path matches href (with normalization)
  const isActive = normalizeUrl(pathname) === normalizeUrl(href);

  // Check if any child item is active
  const hasActiveChild = items.some(
    item => normalizeUrl(pathname) === normalizeUrl(item.href),
  );

  // Open collapsible by default if has active child
  const defaultOpen = hasActiveChild;

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
            <Link
              href={href}
              onClick={() => {
                if (isMobile) {
                  toggleSidebar();
                }
              }}
              rel={isOpenInNewTab ? "noopener noreferrer" : undefined}
              target={isOpenInNewTab ? "_blank" : undefined}
            />
          }
          tooltip={title}
        >
          {content}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible defaultOpen={defaultOpen} render={<SidebarMenuItem />}>
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
          {items.map(item => {
            const isChildActive =
              normalizeUrl(pathname) === normalizeUrl(item.href);

            return (
              <SidebarMenuSubItem key={item.href}>
                <SidebarMenuSubButton
                  isActive={isChildActive}
                  render={
                    <Link
                      href={item.href}
                      onClick={() => {
                        if (isMobile) {
                          toggleSidebar();
                        }
                      }}
                      rel={
                        item.isOpenInNewTab ? "noopener noreferrer" : undefined
                      }
                      target={item.isOpenInNewTab ? "_blank" : undefined}
                    />
                  }
                >
                  {item.title}
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
};
