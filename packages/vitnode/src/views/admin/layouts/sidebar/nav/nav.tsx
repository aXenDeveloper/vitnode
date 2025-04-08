import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
} from '@/components/ui/sidebar-server';
import { HomeIcon } from 'lucide-react';

import { ItemNavAdmin } from './item';

export interface NavAdminParent {
  id: string;
  items: React.ComponentProps<typeof ItemNavAdmin>[];
  title: string;
}

export const NavSidebarAdmin = () => {
  const rootItems: NavAdminParent[] = [
    {
      id: 'core',
      title: 'Core',
      items: [
        {
          href: '/admin/core/users',
          title: 'test 123',
          icon: <HomeIcon />,
        },
        {
          href: '/admin/core',
          title: 'test button',
          icon: <HomeIcon />,
          items: [
            {
              title: 'test 123',
              href: '/admin/core/users',
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
