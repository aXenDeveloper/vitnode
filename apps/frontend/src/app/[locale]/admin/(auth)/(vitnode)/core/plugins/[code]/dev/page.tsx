import { OverviewDevPluginAdminView } from 'vitnode-frontend/views/admin/views/core/plugins/dev/overview';

export default function Page(
  props: React.ComponentProps<typeof OverviewDevPluginAdminView>,
) {
  return <OverviewDevPluginAdminView {...props} />;
}
