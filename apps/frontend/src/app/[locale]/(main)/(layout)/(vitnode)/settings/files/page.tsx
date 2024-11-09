import {
  FilesSettingsView,
  generateMetadataFilesSettings,
} from 'vitnode-frontend/views/theme/views/settings/views/files/files-settings-view';

export const generateMetadata = generateMetadataFilesSettings;

export default function Page(
  props: React.ComponentProps<typeof FilesSettingsView>,
) {
  return <FilesSettingsView {...props} />;
}
