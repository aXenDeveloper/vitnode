import { ShowMethodAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';
import { ContentMethodsAuthSettingsAdmin } from './content';
import { fetcher } from '@/api/fetcher';

const getData = async () => {
  const { data } = await fetcher<ShowMethodAuthSettingsAdminObj>({
    url: `/admin/settings/auth/methods`,
    cache: 'force-cache',
  });

  return data;
};

export const MethodsAuthSettingsAdminView = async () => {
  const data = await getData();

  return <ContentMethodsAuthSettingsAdmin {...data} />;
};
