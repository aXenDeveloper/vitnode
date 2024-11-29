import { Button } from '@/components/ui/button';
import { DrawerClose } from '@/components/ui/drawer';
import { useSession } from '@/hooks/use-session';
import { Link } from '@/navigation';
import { SettingsIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ItemUserNavBarMobile } from './item';

export const UserHeaderNavBarMobile = () => {
  const t = useTranslations('core.global');
  const { user } = useSession();

  if (!user) {
    return (
      <div className="flex items-center gap-2 p-6 pb-4 [&>a]:flex-1">
        <DrawerClose asChild>
          <Button asChild variant="outline">
            <Link href="/login">{t('user-bar.sign_in')}</Link>
          </Button>
        </DrawerClose>
        <DrawerClose asChild>
          <Button asChild>
            <Link href="/register">{t('user-bar.sign_up')}</Link>
          </Button>
        </DrawerClose>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1 p-6 pb-4">
        <span className="font-semibold leading-none">{user.name}</span>
        <p className="text-muted-foreground text-sm leading-none">
          {user.email}
        </p>
      </div>

      <div className="flex flex-col px-2">
        <ItemUserNavBarMobile
          href="/settings"
          icon={<SettingsIcon />}
          name={t('user-bar.settings')}
        />
      </div>
    </>
  );
};
