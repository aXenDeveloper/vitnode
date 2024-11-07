import { FormCreateEditPluginAdmin } from '../actions/create/form';
import { getPluginDataAdmin } from './query-api';

export const OverviewDevPluginAdminView = async ({
  params,
}: {
  params: Promise<{ code: string }>;
}) => {
  const { code } = await params;
  const data = await getPluginDataAdmin(code);

  return <FormCreateEditPluginAdmin data={data} theme="horizontal" />;
};
