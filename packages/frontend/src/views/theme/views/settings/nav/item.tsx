'use client';

import { TabsItem } from '@/components/ui/tabs';
import { cn } from '@/helpers/classnames';
import { usePathname } from '@/navigation';

import { NavItemsType } from './nav-settings';

export const ItemNavSettings = ({ icon, text, href }: NavItemsType) => {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <TabsItem
      active={active}
      className={cn('lg:mb-1 lg:justify-start lg:[&>div]:hidden', {
        'lg:bg-primary lg:text-primary-foreground lg:hover:text-primary-foreground lg:hover:bg-primary/90':
          active,
        'lg:text-foreground': !active,
      })}
      href={href}
    >
      {icon}
      {text}
    </TabsItem>
  );
};
