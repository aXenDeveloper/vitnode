import type { PluginRoutePageProps } from "@/routing";
import type { AdminDebugLayoutData } from "@/tanstack/admin/debug/route";

import { AdminDebugBreadcrumbContent } from "@/tanstack/admin/debug/breadcrumb";
import { AdminDebugLayoutContent } from "@/tanstack/admin/debug/layout";
import { loadAdminDebugLayout } from "@/tanstack/admin/debug/route";
import {
  defineAdminRoute,
  routeBreadcrumbGroup,
} from "@/tanstack/plugin-routes";

const AdminDebugLayout = ({
  children,
  loaderData,
}: PluginRoutePageProps<AdminDebugLayoutData> & {
  children: React.ReactNode;
}) => (
  <AdminDebugLayoutContent
    description={loaderData.description}
    title={loaderData.title}
  >
    {children}
  </AdminDebugLayoutContent>
);

export const route = defineAdminRoute<AdminDebugLayoutData>({
  load: async ({ context, t }) => await loadAdminDebugLayout({ ...context, t }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: routeBreadcrumbGroup(function AdminDebugBreadcrumb() {
    return <AdminDebugBreadcrumbContent />;
  }),
});

export default AdminDebugLayout;
