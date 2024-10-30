import {
  generateMetadataMainSettingsCoreAdmin,
  MainSettingsCoreAdminView,
} from 'vitnode-frontend/views/admin/views/core/settings/main/main-settings-core-admin-view';

export const generateMetadata = generateMetadataMainSettingsCoreAdmin;

export default function Page() {
  return <MainSettingsCoreAdminView />;
}
