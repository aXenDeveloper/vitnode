import { getSessionAdminData } from '@/api/get-session-admin-data';
import { Icon } from '@/components/icon/icon';
import { LogoVitNode } from '@/components/logo-vitnode';
import { LanguageSwitcher } from '@/components/switchers/language-switcher';
import { ThemeSwitcher } from '@/components/switchers/theme-switcher';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Sidebar } from '@/components/ui/sidebar';
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar-server';
import { Link } from '@/navigation';
import { ChevronRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { SearchSidebarAdmin } from './search/search';
import { UserBarSidebarAdmin } from './user-bar';

export interface TextAndIconsAsideAdmin {
  icon: null | React.ReactNode;
  id: string;
  parent_text?: string;
  plugin: string;
  plugin_code: string;
  text: string;
}

export const SidebarAdmin = async () => {
  const [t, { nav }] = await Promise.all([
    getTranslations(),
    getSessionAdminData(),
  ]);

  // Flat map to remove children
  const flatNav: {
    code: string;
    icon?: string;
    parent_icon?: string;
    parent_nav_code?: string;
    plugin: string;
  }[] = nav.flatMap(item => {
    const navParent = item.nav.flatMap(nav => ({
      code_plugin: item.code,
      ...nav,
      plugin: item.code,
    }));

    return navParent.flatMap(nav => {
      const children = nav.children ?? [];
      const mappedChildren = children.map(child => ({
        code_plugin: nav.code_plugin,
        parent_nav_code: nav.children ? nav.code : undefined,
        ...child,
        plugin: item.code,
        parent_icon: nav.icon,
      }));

      return [nav, ...mappedChildren];
    });
  });

  const textsAndIcons: TextAndIconsAsideAdmin[] = flatNav.map(item => {
    const id = item.parent_nav_code
      ? `${item.parent_nav_code}_${item.code}`
      : item.code;

    const getIcon = () => {
      if (item.parent_icon) return <Icon name={item.parent_icon} />;
      if (item.icon) return <Icon name={item.icon} />;

      return null;
    };

    return {
      id,
      parent_text: item.parent_nav_code
        ? // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          t(`admin_${item.plugin}.nav.${item.parent_nav_code}`)
        : undefined,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      text: t(`admin_${item.plugin}.nav.${id}`),
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      plugin: t(`admin_${item.plugin}.nav.title`),
      icon: getIcon(),
      plugin_code: item.plugin,
    };
  });

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="flex-row items-center justify-between">
        <Link href="/admin/core/dashboard">
          <LogoVitNode className="h-8" small />
        </Link>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeSwitcher />

          <UserBarSidebarAdmin />
        </div>
      </SidebarHeader>
      <SearchSidebarAdmin />
      <SidebarContent>
        {nav.map(plugin => {
          return (
            <SidebarGroup key={plugin.code}>
              <SidebarGroupLabel>
                {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                {/* @ts-expect-error */}
                {t(`admin_${plugin.code}.nav.title`)}
              </SidebarGroupLabel>

              <SidebarMenu>
                {plugin.nav.map(item => {
                  const textAndIcon = textsAndIcons.find(
                    el => el.id === item.code && el.plugin_code === plugin.code,
                  );
                  if (!textAndIcon) return null;

                  const button = (
                    <SidebarMenuButton asChild>
                      <Link href={`/admin/${plugin.code}/${item.code}`}>
                        {textAndIcon.icon}
                        <span>{textAndIcon.text}</span>
                      </Link>
                    </SidebarMenuButton>
                  );

                  if (!item.children?.length) {
                    return (
                      <SidebarMenuItem key={`${plugin.code}_${item.code}`}>
                        {button}
                      </SidebarMenuItem>
                    );
                  }

                  return (
                    <Collapsible asChild key={`${plugin.code}_${item.code}`}>
                      <SidebarMenuItem>
                        {button}
                        <>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuAction className="data-[state=open]:rotate-90">
                              <ChevronRight />
                              <span className="sr-only">
                                {t('core.global.sidebar.toggle')}
                              </span>
                            </SidebarMenuAction>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {item.children.map(child => {
                                const textAndIcon = textsAndIcons.find(
                                  el =>
                                    el.id === `${item.code}_${child.code}` &&
                                    el.plugin_code === plugin.code,
                                );
                                if (!textAndIcon) return null;
                                const href = `/admin/${plugin.code}/${item.code}/${child.code}`;

                                return (
                                  <SidebarMenuSubItem
                                    key={`${plugin.code}_${item.code}_${child.code}`}
                                  >
                                    <SidebarMenuSubButton asChild>
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
                })}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
};
