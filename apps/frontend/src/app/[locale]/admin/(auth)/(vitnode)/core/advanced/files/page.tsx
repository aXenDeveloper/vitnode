import {
  FilesAdvancedCoreAdminView,
  generateMetadataFilesAdvancedCoreAdmin,
} from 'vitnode-frontend/views/admin/views/core/advanced/files/files-advanced-core-admin-view';

export const generateMetadata = generateMetadataFilesAdvancedCoreAdmin;

export default function Page(
  props: React.ComponentProps<typeof FilesAdvancedCoreAdminView>,
) {
  return <FilesAdvancedCoreAdminView {...props} />;
}
