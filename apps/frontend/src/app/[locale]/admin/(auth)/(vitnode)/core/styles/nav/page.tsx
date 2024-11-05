import {
  generateMetadataNavAdmin,
  NavAdminView,
} from 'vitnode-frontend/views/admin/views/core/styles/nav/nav-admin-view';

export const generateMetadata = generateMetadataNavAdmin;

export default function Page() {
  return <NavAdminView />;
}
