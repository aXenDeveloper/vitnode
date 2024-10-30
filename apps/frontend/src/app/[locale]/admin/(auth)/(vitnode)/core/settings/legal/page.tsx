import {
  generateMetadataLegalSettingsAdmin,
  LegalSettingsAdminView,
} from 'vitnode-frontend/views/admin/views/core/settings/legal/legal-core-admin-view';

export const generateMetadata = generateMetadataLegalSettingsAdmin;

export default function Page(
  props: React.ComponentProps<typeof LegalSettingsAdminView>,
) {
  return <LegalSettingsAdminView {...props} />;
}
