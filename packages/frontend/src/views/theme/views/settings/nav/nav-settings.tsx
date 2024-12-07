import { Tabs } from '@/components/ui/tabs';
import { CogIcon, FilesIcon, MonitorSmartphoneIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { ItemNavSettings } from './item';

export interface NavItemsType {
  href: string;
  icon: React.ReactNode;
  text: string;
}

export const NavSettings = async () => {
  const t = await getTranslations('core.settings');
  const navItems: NavItemsType[] = [
    {
      href: '/settings',
      icon: <CogIcon />,
      text: t('overview.title'),
    },
    {
      href: '/settings/files',
      icon: <FilesIcon />,
      text: t('files.title'),
    },
    {
      href: '/settings/devices',
      icon: <MonitorSmartphoneIcon />,
      text: t('devices.title'),
    },
  ];

  return (
    <Tabs className="lg:w-64 lg:flex-col lg:shadow-none">
      {navItems.map(item => (
        <ItemNavSettings key={item.href} {...item} />
      ))}
    </Tabs>
  );
};
