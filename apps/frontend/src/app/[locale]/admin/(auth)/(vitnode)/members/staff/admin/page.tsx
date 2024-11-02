import {
  AdminStaffAdminView,
  generateMetadataAdminStaffAdmin,
} from 'vitnode-frontend/views/admin/views/members/staff/admin/admin-view';

export const generateMetadata = generateMetadataAdminStaffAdmin;

export default function Page(
  props: React.ComponentProps<typeof AdminStaffAdminView>,
) {
  return <AdminStaffAdminView {...props} />;
}
