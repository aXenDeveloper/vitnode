import { fetcher } from '@/api/fetcher';
import { getMiddlewareData } from '@/api/get-middleware-data';
import { ShowAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';

import { ContentAuthorizationSettingsAdminView } from './content';

const getData = async () => {
  const { data } = await fetcher<ShowAuthSettingsAdminObj>({
    url: '/admin/settings/auth',
    cache: 'force-cache',
  });

  return data;
};

export const AuthorizationSettingsAdminView = async () => {
  const [data, { is_email_enabled }] = await Promise.all([
    getData(),
    getMiddlewareData(),
  ]);

  return (
    <ContentAuthorizationSettingsAdminView
      isEmailEnabled={is_email_enabled}
      {...data}
    />
  );
};
