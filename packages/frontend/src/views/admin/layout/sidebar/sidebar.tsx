import {
  getSessionAdminData,
  isInAdminPermission,
} from '@/api/get-session-admin-data';
import { DynamicIcon } from '@/components/icon/dynamic-icon';
import { LogoVitNode } from '@/components/logo-vitnode';
import { LanguageSwitcher } from '@/components/switchers/language-switcher';
import { ThemeSwitcher } from '@/components/switchers/theme-switcher';
import { Sidebar } from '@/components/ui/sidebar';
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
} from '@/components/ui/sidebar-server';
import { cn } from '@/helpers/classnames';
import { CONFIG } from '@/helpers/config-with-env';
import { Link } from '@/navigation';
import { getTranslations } from 'next-intl/server';

import { ItemNavSidebarAdmin } from './item-nav';
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
  const [t, { nav, user }] = await Promise.all([
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
      if (item.parent_icon) return <DynamicIcon name={item.parent_icon} />;
      if (item.icon) return <DynamicIcon name={item.icon} />;

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
    <Sidebar variant="sidebar">
      <SidebarHeader
        className={cn('relative flex-row items-center justify-between', {
          'pt-3': CONFIG.node_development,
        })}
      >
        {CONFIG.node_development && (
          <div
            className="absolute left-0 top-0 z-50 h-1 w-full"
            style={{
              backgroundImage:
                'repeating-linear-gradient(-55deg,#000, #000 20px, #ffb103 20px, #feb100 40px)',
            }}
          />
        )}

        <Link href="/admin/core/dashboard">
          <LogoVitNode className="h-8" small />
        </Link>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeSwitcher />

          <UserBarSidebarAdmin
            canShowDiagnosticTools={await isInAdminPermission({
              plugin_code: 'core',
              group: 'dashboard',
              permission: 'can_manage_diagnostic_tools',
            })}
            user={user}
          />
        </div>
      </SidebarHeader>
      <SearchSidebarAdmin textsAndIcons={textsAndIcons} />
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
                {plugin.nav.map(item => (
                  <ItemNavSidebarAdmin
                    item={item}
                    key={`${plugin.code}_${item.code}`}
                    plugin_code={plugin.code}
                    textsAndIcons={textsAndIcons}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
};
