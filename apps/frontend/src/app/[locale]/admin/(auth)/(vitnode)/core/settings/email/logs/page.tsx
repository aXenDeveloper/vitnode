import {
  generateMetadataLogsEmailSettingsAdmin,
  LogsEmailSettingsAdminView,
} from 'vitnode-frontend/views/admin/views/core/settings/email/logs/logs-email-settings-admin-view';

export const generateMetadata = generateMetadataLogsEmailSettingsAdmin;

export default function Page(
  props: React.ComponentProps<typeof LogsEmailSettingsAdminView>,
) {
  return <LogsEmailSettingsAdminView {...props} />;
}
