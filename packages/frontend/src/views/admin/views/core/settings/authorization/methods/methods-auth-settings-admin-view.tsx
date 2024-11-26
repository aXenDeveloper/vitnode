import { fetcher } from '@/api/fetcher';
import { HeaderContent } from '@/components/ui/header-content';
import { getTranslations } from 'next-intl/server';
import { ShowMethodAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';

import { CreateMethodsAuthSettingsAdmin } from '../create/create';
import { ContentMethodsAuthSettingsAdmin } from './content';

const getData = async () => {
  const { data } = await fetcher<ShowMethodAuthSettingsAdminObj>({
    url: `/admin/settings/auth/methods`,
    cache: 'force-cache',
  });

  return data;
};

export const MethodsAuthSettingsAdminView = async () => {
  const [t, data] = await Promise.all([
    getTranslations('admin.core.settings.authorization.methods'),
    getData(),
  ]);

  return (
    <>
      <HeaderContent h1={t('title')}>
        {data.enabledMethods.length > 0 && (
          <CreateMethodsAuthSettingsAdmin {...data} />
        )}
      </HeaderContent>
      <ContentMethodsAuthSettingsAdmin {...data} />
    </>
  );
};
