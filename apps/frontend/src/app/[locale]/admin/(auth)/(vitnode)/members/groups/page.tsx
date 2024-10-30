import {
  generateMetadataGroupsMembersAdmin,
  GroupsMembersAdminView,
} from 'vitnode-frontend/views/admin/views/members/groups/groups-members-admin-view';

export const generateMetadata = generateMetadataGroupsMembersAdmin;

export default function Page(
  props: React.ComponentProps<typeof GroupsMembersAdminView>,
) {
  return <GroupsMembersAdminView {...props} />;
}
