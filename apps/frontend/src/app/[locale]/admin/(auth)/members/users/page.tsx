import {
  generateMetadataUsersMembersAdmin,
  UsersMembersAdminView,
} from 'vitnode-frontend/views/admin/views/members/users/users-members-admin-view';

export const generateMetadata = generateMetadataUsersMembersAdmin;

export default function Page(
  props: React.ComponentProps<typeof UsersMembersAdminView>,
) {
  return <UsersMembersAdminView {...props} />;
}
