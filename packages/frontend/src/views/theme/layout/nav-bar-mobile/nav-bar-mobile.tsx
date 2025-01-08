'use client';

import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { AvatarUser } from '@/components/ui/user/avatar';
import { useMiddlewareData } from '@/hooks/use-middleware-data';
import { usePathname, useRouter } from '@/navigation';
import { DialogDescription, DialogTitle } from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { ArrowLeftIcon, MenuIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { UserWithDangerousInfo } from 'vitnode-shared/user.dto';

import { UserFooterNavBarMobile } from './content/user-footer';
import { UserHeaderNavBarMobile } from './content/user-header';
import { ItemNavBarMobile } from './item';
import { NavNavBarMobile } from './nav/nav';

export const NavBarMobile = ({
  user,
}: {
  user: null | UserWithDangerousInfo;
}) => {
  const t = useTranslations('core.global');
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
      {/* <ItemNavBarMobile href="/search" title={t('mobile_nav.search')}>
        <SearchIcon />
      </ItemNavBarMobile> */}

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

          <UserHeaderNavBarMobile user={user} />
          {nav.length > 0 && <NavNavBarMobile />}
          {user && <UserFooterNavBarMobile user={user} />}
        </DrawerContent>
      </Drawer>
    </>
  );
};
