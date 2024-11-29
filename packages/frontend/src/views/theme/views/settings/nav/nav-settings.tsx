import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { DialogDescription, DialogTitle } from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
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
    <aside className="bg-card h-fit rounded-md border lg:w-64 lg:border-none lg:bg-transparent">
      <div className="hidden flex-col gap-1 lg:flex">
        {navItems.map(item => (
          <ItemNavSettings key={item.href} {...item} />
        ))}
      </div>

      <div className="block lg:hidden">
        <Drawer>
          <DrawerTrigger className="h-9 w-full">
            {t('open_sheet')}
          </DrawerTrigger>

          <DrawerContent>
            <VisuallyHidden>
              <DialogTitle>{t('open_sheet')}</DialogTitle>
              <DialogDescription>{t('open_sheet_desc')}</DialogDescription>
            </VisuallyHidden>

            <div className="flex flex-col p-5">
              {navItems.map(item => (
                <DrawerClose asChild key={item.href}>
                  <ItemNavSettings {...item} />
                </DrawerClose>
              ))}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </aside>
  );
};
