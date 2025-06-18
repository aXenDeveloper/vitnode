import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';

import { ThemeSwitcher } from '@/components/switchers/themes/theme-switcher';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import { getSessionAdminApi } from '@/lib/api/get-session-admin-api';

import type { VitNodeConfig } from '../../../vitnode.config';
import type { NavAdminParent } from './sidebar/nav/nav';

import { I18nProvider } from '../../../components/i18n-provider';
import { SidebarAdmin } from './sidebar/sidebar';
import { UserBarAdmin } from './user-bar/user-bar';
import { LanguageSwitcher } from '../../../components/switchers/langs/language-swietcher';

export interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout = async ({
  children,
  vitNodeConfig,
}: AdminLayoutProps & {
  vitNodeConfig: VitNodeConfig;
}) => {
  const t = await getTranslations();
  const session = await getSessionAdminApi();
  const cookieStore = await cookies();
  const defaultOpen =
    cookieStore.get(vitNodeConfig.admin?.sidebarCookieName ?? 'sidebar_state')
      ?.value === 'true';
  if (!session) return null;

  const pluginNav: NavAdminParent[] = vitNodeConfig.plugins
    .filter(plugin => plugin.admin?.nav)
    .map(plugin => ({
      id: plugin.pluginId,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      title: t(`${plugin.pluginId}.title`),
      items: (plugin.admin?.nav ?? []).map(item => ({
        ...item,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        title: t(`${plugin.pluginId}.admin.nav.${item.id}`),
        items:
          item.items?.map(subItem => ({
            ...subItem,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            title: t(`${plugin.pluginId}.admin.nav.${item.id}.${subItem.id}`),
          })) ?? [],
      })),
    }));

  return (
    <I18nProvider namespaces={['admin.global']}>
      <SidebarProvider defaultOpen={defaultOpen}>
        <SidebarAdmin pluginNav={pluginNav} />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />

            <div className="ml-auto flex items-center justify-center gap-2 px-2">
              <LanguageSwitcher locales={vitNodeConfig.i18n.locales} />
              <ThemeSwitcher />
              <UserBarAdmin user={session.user} />
            </div>
          </header>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </I18nProvider>
  );
};
