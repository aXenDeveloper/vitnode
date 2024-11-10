import {
  generateMetadataSpamSecurityAdmin,
  SpamSecurityAdminLayout,
} from 'vitnode-frontend/views/admin/views/core/security/spam/layout';

export const generateMetadata = generateMetadataSpamSecurityAdmin;

export default function Layout(
  props: React.ComponentProps<typeof SpamSecurityAdminLayout>,
) {
  return <SpamSecurityAdminLayout {...props} />;
}
