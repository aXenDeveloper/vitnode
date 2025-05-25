import { UsersAdminView } from 'vitnode/views/admin/views/core/users/users-admin-view';

export default function Page(
  props: React.ComponentProps<typeof UsersAdminView>,
) {
  return <UsersAdminView {...props} />;
}
