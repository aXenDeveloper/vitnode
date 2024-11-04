import {
  generateMetadataPluginsAdmin,
  PluginsAdminView,
} from 'vitnode-frontend/views/admin/views/core/plugins/plugins-admin-view';

export const generateMetadata = generateMetadataPluginsAdmin;

export default function Page(
  props: React.ComponentProps<typeof PluginsAdminView>,
) {
  return <PluginsAdminView {...props} />;
}
