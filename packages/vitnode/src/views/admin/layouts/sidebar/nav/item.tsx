'use client';

import { ChevronRight, MenuIcon } from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { SidebarMenuButton, useSidebar } from '@/components/ui/sidebar';
import {
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { Link } from '@/lib/navigation';
import { cn } from '@/lib/utils';

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
  items?: Omit<ItemNavAdminProps, 'icon'>[];
}) => {
  const { toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();

  const content = (
    <>
      {icon ?? <MenuIcon />}
      <span>{title}</span>
    </>
  );

  if (!items.length) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip={title}>
          <Link
            href={href}
            onClick={() => {
              if (isMobile) {
                toggleSidebar();
              }
            }}
            prefetch
            rel={isOpenInNewTab ? 'noopener noreferrer' : undefined}
            target={isOpenInNewTab ? '_blank' : undefined}
          >
            {content}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible asChild className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={title}>
            {content}
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>

        <CollapsibleContent
          className={cn(
            'text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 outline-none',
          )}
        >
          <SidebarMenuSub>
            {items.map(item => (
              <SidebarMenuSubItem key={item.href}>
                <SidebarMenuSubButton asChild>
                  <Link
                    href={item.href}
                    onClick={() => {
                      if (isMobile) {
                        toggleSidebar();
                      }
                    }}
                    prefetch
                    rel={
                      item.isOpenInNewTab ? 'noopener noreferrer' : undefined
                    }
                    target={item.isOpenInNewTab ? '_blank' : undefined}
                  >
                    {item.title}
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
};
