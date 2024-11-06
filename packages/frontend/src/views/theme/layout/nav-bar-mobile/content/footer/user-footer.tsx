import { Separator } from '@/components/ui/separator';
import { useSignOutApi } from '@/hooks/sign/out/use-sign-out-api';
import { useSession } from '@/hooks/use-session';
import { KeyRoundIcon, LogOutIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ItemUserFooterNavBarMobile } from './item';

export const UserFooterNavBarMobile = () => {
  const t = useTranslations('core.global.user-bar');
  const { user } = useSession();
  const { onSubmit } = useSignOutApi({});

  return (
    <div className="my-4 flex flex-col px-2">
      {user?.is_admin && (
        <>
          <Separator className="my-1" />

          <ItemUserFooterNavBarMobile
            href="/admin"
            icon={<KeyRoundIcon />}
            name={t('admin_cp')}
            target="_blank"
          />
        </>
      )}

      <Separator className="my-1" />

      <ItemUserFooterNavBarMobile
        icon={<LogOutIcon />}
        name={t('log_out')}
        onClick={onSubmit}
      />
    </div>
  );
};
