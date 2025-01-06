import DefaultPage from '@/plugins/welcome/templates/default-page';
import React from 'react';
import { generateMetadataDefaultPage } from 'vitnode-frontend/views/theme/views/default-page';

export const generateMetadata = generateMetadataDefaultPage;

export default function Page() {
  return <DefaultPage />;
}
