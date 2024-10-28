import {
  generateMetadataUserMembersAdmin,
  UserMembersAdminView,
} from 'vitnode-frontend/views/admin/views/members/user/user-members-admin-view';

export const generateMetadata = generateMetadataUserMembersAdmin;

export default function Page(
  props: React.ComponentProps<typeof UserMembersAdminView>,
) {
  return <UserMembersAdminView {...props} />;
}
