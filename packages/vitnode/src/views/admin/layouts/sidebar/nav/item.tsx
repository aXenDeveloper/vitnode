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
        <SidebarMenuButton asChild isActive={isActive} tooltip={title}>
          <Link
            href={href}
            onClick={() => {
              if (isMobile) {
                toggleSidebar();
              }
            }}
            rel={isOpenInNewTab ? "noopener noreferrer" : undefined}
            target={isOpenInNewTab ? "_blank" : undefined}
          >
            {content}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible
      asChild
      className="group/collapsible"
      defaultOpen={defaultOpen}
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={isActive || hasActiveChild}
            tooltip={title}
          >
            {content}
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>

        <CollapsibleContent
          className={cn(
            "text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 outline-none",
          )}
        >
          <SidebarMenuSub>
            {items.map(item => {
              const isChildActive =
                normalizeUrl(pathname) === normalizeUrl(item.href);

              return (
                <SidebarMenuSubItem key={item.href}>
                  <SidebarMenuSubButton asChild isActive={isChildActive}>
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
                    >
                      {item.title}
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
};
