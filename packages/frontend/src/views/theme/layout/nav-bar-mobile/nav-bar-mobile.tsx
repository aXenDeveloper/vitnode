'use client';

import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { AvatarUser } from '@/components/ui/user/avatar';
import { useMiddlewareData } from '@/hooks/use-middleware-data';
import { useSession } from '@/hooks/use-session';
import { usePathname, useRouter } from '@/navigation';
import { DialogDescription, DialogTitle } from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { ArrowLeftIcon, MenuIcon, SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { UserFooterNavBarMobile } from './content/user-footer';
import { UserHeaderNavBarMobile } from './content/user-header';
import { ItemNavBarMobile } from './item';
import { NavNavBarMobile } from './nav/nav';

export const NavBarMobile = () => {
  const t = useTranslations('core.global');
  const { user } = useSession();
  const pathname = usePathname();
  const { back } = useRouter();
  const { nav } = useMiddlewareData();

  return (
    <>
      {pathname !== '/' && (
        <ItemNavBarMobile onClick={back} title={t('mobile_nav.back')}>
          <ArrowLeftIcon />
        </ItemNavBarMobile>
      )}
      <ItemNavBarMobile href="/search" title={t('mobile_nav.search')}>
        <SearchIcon />
      </ItemNavBarMobile>

      <Drawer>
        <DrawerTrigger asChild>
          <ItemNavBarMobile title={t('mobile_nav.menu')}>
            {user ? <AvatarUser sizeInRem={1.5} user={user} /> : <MenuIcon />}
          </ItemNavBarMobile>
        </DrawerTrigger>

        <DrawerContent>
          <VisuallyHidden>
            <DialogTitle>{t('mobile_nav.menu')}</DialogTitle>
            <DialogDescription>{t('mobile_nav.desc')}</DialogDescription>
          </VisuallyHidden>

          <UserHeaderNavBarMobile />
          {nav.length > 0 && <NavNavBarMobile />}
          {user && <UserFooterNavBarMobile />}
        </DrawerContent>
      </Drawer>
    </>
  );
};
