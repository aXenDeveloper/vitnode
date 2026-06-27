import { LayoutStaffAdmin } from "@vitnode/core/views/admin/views/core/staff/layout";

export default function Layout(
  props: React.ComponentProps<typeof LayoutStaffAdmin>,
) {
  return <LayoutStaffAdmin {...props} />;
}
