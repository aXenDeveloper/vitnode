import { AdminLayout } from '@vitnode/core/views/admin/layouts/admin-layout';

export default function Layout(
  props: React.ComponentProps<typeof AdminLayout>,
) {
  return <AdminLayout {...props} />;
}
