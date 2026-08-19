import {
  AdminLayout,
  type AdminLayoutProps,
} from "@vitnode/core/views/admin/layouts/admin-layout";

import { vitNodeConfig } from "@/vitnode.config";

export const instant = false;

export default function Layout(props: AdminLayoutProps) {
  return <AdminLayout vitNodeConfig={vitNodeConfig} {...props} />;
}
