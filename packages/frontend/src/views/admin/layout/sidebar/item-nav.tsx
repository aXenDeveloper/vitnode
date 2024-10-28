'use client';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar-server';
import { Link, usePathname } from '@/navigation';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { ParentNavAuthAdminObj } from 'vitnode-shared/admin/auth.dto';

import { TextAndIconsAsideAdmin } from './sidebar';

export const ItemNavSidebarAdmin = ({
  item,
  textsAndIcons,
  plugin_code,
}: {
  item: ParentNavAuthAdminObj;
  plugin_code: string;
  textsAndIcons: TextAndIconsAsideAdmin[];
}) => {
  const pathname = usePathname();
  const href = `/admin/${plugin_code}/${item.code}`;
  const [open, setOpen] = React.useState(pathname.startsWith(href));
  const t = useTranslations();
  const textAndIcon = textsAndIcons.find(
    el => el.id === item.code && el.plugin_code === plugin_code,
  );
  if (!textAndIcon) return null;

  const button = (
    <SidebarMenuButton
      asChild
      isActive={pathname.startsWith(href)}
      onClick={() => {
        setOpen(true);
      }}
    >
      <Link href={href}>
        {textAndIcon.icon}
        <span>{textAndIcon.text}</span>
      </Link>
    </SidebarMenuButton>
  );

  if (!item.children?.length) {
    return <SidebarMenuItem>{button}</SidebarMenuItem>;
  }

  return (
    <Collapsible
      asChild
      defaultOpen={pathname.startsWith(href)}
      onOpenChange={setOpen}
      open={open}
    >
      <SidebarMenuItem>
        {button}
        <>
          <CollapsibleTrigger asChild>
            <SidebarMenuAction className="data-[state=open]:rotate-90">
              <ChevronRight />
              <span className="sr-only">{t('core.global.sidebar.toggle')}</span>
            </SidebarMenuAction>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <SidebarMenuSub>
              {item.children.map(child => {
                const textAndIcon = textsAndIcons.find(
                  el =>
                    el.id === `${item.code}_${child.code}` &&
                    el.plugin_code === plugin_code,
                );
                if (!textAndIcon) return null;
                const href = `/admin/${plugin_code}/${item.code}/${child.code}`;

                return (
                  <SidebarMenuSubItem
                    key={`${plugin_code}_${item.code}_${child.code}`}
                  >
                    <SidebarMenuSubButton
                      asChild
                      isActive={pathname.startsWith(href)}
                    >
                      <Link href={href}>
                        <span>{textAndIcon.text}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                );
              })}
            </SidebarMenuSub>
          </CollapsibleContent>
        </>
      </SidebarMenuItem>
    </Collapsible>
  );
};
