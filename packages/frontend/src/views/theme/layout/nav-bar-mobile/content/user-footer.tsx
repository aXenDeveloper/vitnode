import { Separator } from '@/components/ui/separator';
import { useSignOutApi } from '@/views/theme/layout/header/auth-user-bar/hooks/use-sign-out-api';
import { KeyRoundIcon, LogOutIcon, SettingsIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ItemUserNavBarMobile } from './item';
import { UserWithDangerousInfo } from 'vitnode-shared/user.dto';

export const UserFooterNavBarMobile = ({
  user,
}: {
  user: UserWithDangerousInfo;
}) => {
  const t = useTranslations('core.global.user-bar');
  const { onSubmit } = useSignOutApi({});

  return (
    <div className="mb-4 flex flex-col px-2">
      <ItemUserNavBarMobile
        href="/settings"
        icon={<SettingsIcon />}
        name={t('settings')}
      />
      {user.is_admin && (
        <>
          <Separator className="my-1" />

          <ItemUserNavBarMobile
            href="/admin"
            icon={<KeyRoundIcon />}
            name={t('admin_cp')}
            target="_blank"
          />
        </>
      )}

      <Separator className="my-1" />

      <ItemUserNavBarMobile
        icon={<LogOutIcon />}
        name={t('log_out')}
        onClick={onSubmit}
      />
    </div>
  );
};
