import { FormCreateEditPluginAdmin } from '../actions/create/form';
import { getPluginDataAdmin } from './query-api';

export const OverviewDevPluginAdminView = async ({
  code,
}: {
  code: string;
}) => {
  const data = await getPluginDataAdmin(code);

  return <FormCreateEditPluginAdmin data={data} theme="horizontal" />;
};
