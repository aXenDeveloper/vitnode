import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
} from '@/components/ui/sidebar';
import { LayoutDashboardIcon, UsersRoundIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { ItemNavAdmin } from './item';

export interface NavAdminParent {
  id: string;
  items: React.ComponentProps<typeof ItemNavAdmin>[];
  title: string;
}

export const NavSidebarAdmin = async () => {
  const t = await getTranslations('admin.global.nav');
  const rootItems: NavAdminParent[] = [
    {
      id: 'core',
      title: t('core'),
      items: [
        {
          href: '/admin/core/',
          icon: <LayoutDashboardIcon />,
          title: t('dashboard'),
        },
        {
          href: '/admin/core/users',
          title: t('users.title'),
          icon: <UsersRoundIcon />,
          items: [
            {
              title: t('users.list'),
              href: '/admin/core/users',
            },
            {
              title: 'test',
              href: '/admin/core/test',
            },
          ],
        },
      ],
    },
  ];

  return rootItems.map(parent => (
    <SidebarGroup key={parent.title}>
      <SidebarGroupLabel>{parent.title}</SidebarGroupLabel>
      <SidebarMenu>
        {parent.items.map(item => (
          <ItemNavAdmin key={item.href} {...item} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  ));
};
