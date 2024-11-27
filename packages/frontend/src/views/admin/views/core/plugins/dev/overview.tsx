import { FormCreateEditPluginAdmin } from '../actions/create/form';
import { getPluginDataAdmin } from './query-api';

export const OverviewDevPluginAdminView = async ({
  pluginCode,
}: {
  pluginCode: string;
}) => {
  const data = await getPluginDataAdmin(pluginCode);

  return <FormCreateEditPluginAdmin data={data} theme="horizontal" />;
};
