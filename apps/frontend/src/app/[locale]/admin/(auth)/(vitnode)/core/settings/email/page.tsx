import {
  EmailSettingsAdminView,
  generateMetadataEmailSettingsAdmin,
} from 'vitnode-frontend/views/admin/views/core/settings/email/email-settings-admin-view';

export const generateMetadata = generateMetadataEmailSettingsAdmin;

export default function Page() {
  return <EmailSettingsAdminView />;
}
