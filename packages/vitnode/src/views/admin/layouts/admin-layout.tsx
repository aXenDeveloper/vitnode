import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';

import { ThemeSwitcher } from '@/components/switchers/theme-switcher';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import { getSessionAdminApi } from '@/lib/api/get-session-admin-api';

import type { VitNodeConfig } from '../../../vitnode.config';
import type { NavAdminParent } from './sidebar/nav/nav';

import { SidebarAdmin } from './sidebar/sidebar';
import { UserBarAdmin } from './user-bar/user-bar';

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
      id: plugin.id,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      title: t(`${plugin.id}.title`),
      items: (plugin.admin?.nav ?? []).map(item => ({
        ...item,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        title: t(`${plugin.id}.admin.nav.${item.id}`),
        items:
          item.items?.map(subItem => ({
            ...subItem,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            title: t(`${plugin.id}.admin.nav.${item.id}.${subItem.id}`),
          })) ?? [],
      })),
    }));

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <SidebarAdmin pluginNav={pluginNav} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />

          <div className="ml-auto flex items-center justify-center gap-2 px-2">
            <ThemeSwitcher />
            <UserBarAdmin user={session.user} />
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
};
