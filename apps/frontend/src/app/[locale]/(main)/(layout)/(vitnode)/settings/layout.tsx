import React from 'react';
import {
  generateMetadataLayoutSettings,
  LayoutSettingsView,
} from 'vitnode-frontend/views/theme/views/settings/layout';

export const generateMetadata = generateMetadataLayoutSettings;

export default function Layout(
  props: React.ComponentProps<typeof LayoutSettingsView>,
) {
  return <LayoutSettingsView {...props} />;
}
