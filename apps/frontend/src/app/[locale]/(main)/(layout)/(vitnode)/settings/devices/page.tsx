import {
  DevicesSettingsView,
  generateMetadataDevicesSettings,
} from 'vitnode-frontend/views/theme/views/settings/views/devices/devices-settings-view';

export const generateMetadata = generateMetadataDevicesSettings;

export default function Page() {
  return <DevicesSettingsView />;
}
