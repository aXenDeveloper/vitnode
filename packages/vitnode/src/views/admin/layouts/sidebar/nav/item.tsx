"use client";

import { ChevronRight, MenuIcon } from "lucide-react";
import { useEffect, useState } from "react";

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

  // True when the pathname is the href itself or lives under it as a path
  // segment (e.g. an edit/create sub-page), matching whole segments only.
  const isPathnameUnderHref = (candidate: string) => {
    const normalizedPathname = normalizeUrl(pathname);
    const normalizedHref = normalizeUrl(candidate);

    return (
      normalizedPathname === normalizedHref ||
      normalizedPathname.startsWith(`${normalizedHref}/`)
    );
  };

  // Check if current path matches href (with normalization)
  const isActive = normalizeUrl(pathname) === normalizeUrl(href);

  // Only the most specific (longest) matching child is active, so nested
  // siblings like `/users` and `/users/roles` don't both highlight.
  const activeChildHref = items.reduce<null | string>((best, item) => {
    if (!isPathnameUnderHref(item.href)) return best;
    if (best === null) return item.href;

    return normalizeUrl(item.href).length > normalizeUrl(best).length
      ? item.href
      : best;
  }, null);

  // Check if any child item is active
  const hasActiveChild = activeChildHref !== null;

  // Open collapsible by default if has active child, and keep it open when
  // navigating into one of its children. Controlled to avoid Base UI warning
  // about changing the default open state of an uncontrolled Collapsible.
  const [open, setOpen] = useState(hasActiveChild);

  useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler
    if (hasActiveChild) {
      // eslint-disable-next-line react-hooks/set-state-in-effect, react-you-might-not-need-an-effect/no-derived-state, @eslint-react/set-state-in-effect
      setOpen(true);
    }
  }, [hasActiveChild]);

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
          {items.map(item => {
            const isChildActive = item.href === activeChildHref;

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
