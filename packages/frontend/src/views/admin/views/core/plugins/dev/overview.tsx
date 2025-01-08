import { getSessionAdminData } from '@/api/get-session-admin-data';

import { FormCreateEditPluginAdmin } from '../actions/create/form';
import { getPluginDataAdmin } from './query-api';

export const OverviewDevPluginAdminView = async ({
  pluginCode,
}: {
  pluginCode: string;
}) => {
  const [data, { user }] = await Promise.all([
    getPluginDataAdmin(pluginCode),
    getSessionAdminData(),
  ]);

  return (
    <FormCreateEditPluginAdmin data={data} theme="horizontal" user={user} />
  );
};
