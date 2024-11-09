'use client';

import { Button } from '@/components/ui/button';
import { Link, usePathname } from '@/navigation';

import { NavItemsType } from './nav-settings';

export const ItemNavSettings = ({ icon, text, href }: NavItemsType) => {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Button
      asChild
      className="relative justify-start gap-2 [&>svg]:size-5"
      size="sm"
      variant={active ? 'default' : 'ghost'}
    >
      <Link href={href}>
        {icon}
        <span>{text}</span>
      </Link>
    </Button>
  );
};
