import { fetcher } from '@/api/fetcher';
import { HeaderContent } from '@/components/ui/header-content';
import { getTranslations } from 'next-intl/server';
import { ShowMethodAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';

import { ContentMethodsAuthSettingsAdmin } from './content';
import { CreateMethodsAuthSettingsAdmin } from './create-edit/create';

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
  const enabledMethods = data.enabledMethods.filter(
    method => data.edges.findIndex(edge => edge.code === method.code) === -1,
  );

  return (
    <>
      <HeaderContent h1={t('title')}>
        <CreateMethodsAuthSettingsAdmin
          dataFromSSR={data}
          disabled={!enabledMethods.length}
        />
      </HeaderContent>
      <ContentMethodsAuthSettingsAdmin {...data} />
    </>
  );
};
