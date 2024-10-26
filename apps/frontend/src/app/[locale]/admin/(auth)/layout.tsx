import React from 'react';
import {
  AdminLayout,
  generateMetadataAdminLayout,
} from 'vitnode-frontend/views/admin/layout/admin-layout';

export const generateMetadata = generateMetadataAdminLayout;

export default function Layout(
  props: React.ComponentProps<typeof AdminLayout>,
) {
  return <AdminLayout {...props} />;
}
