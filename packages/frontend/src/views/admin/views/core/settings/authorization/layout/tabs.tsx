'use client';

import { Tabs, TabsTrigger } from '@/components/ui/tabs';
import { usePathname } from '@/navigation';
import { useTranslations } from 'next-intl';
import React from 'react';

enum TabsEnum {
  Settings = 'settings',
}

const tabsItems = [
  {
    id: 'settings' as const,
    href: '/admin/core/settings/authorization',
  },
  {
    id: 'methods' as const,
    href: '/admin/core/settings/authorization/methods',
  },
];

export const TabsLayoutAuthorizationSettingsAdmin = () => {
  const t = useTranslations('admin.core.settings.authorization');
  const pathname = usePathname();

  return (
    <Tabs className="mb-4">
      {tabsItems.map(item => (
        <TabsTrigger
          active={pathname === item.href}
          href={item.href}
          id={item.id as TabsEnum}
          key={item.id}
        >
          {t(`${item.id}.title`)}
        </TabsTrigger>
      ))}
    </Tabs>
  );
};
