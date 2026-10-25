import type { PluginRoutePageProps } from "@/routing";
import type { AdminOgImagesRouteData } from "@/tanstack/admin/og-images/route";

import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { loadAdminOgImagesRoute } from "@/tanstack/admin/og-images/route";
import { AdminOgImagesRouteContent } from "@/tanstack/admin/og-images/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminOgImagesPage = ({
  loaderData,
}: PluginRoutePageProps<AdminOgImagesRouteData>) => (
  <AdminOgImagesRouteContent {...loaderData} />
);

export const route = defineAdminRoute<AdminOgImagesRouteData>({
  // `head` after `load`, always.
  load: async ({ context, t }) =>
    await loadAdminOgImagesRoute({ ...context, t }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({ segments: ["core", "seo", "og-images"] }),
});

export default AdminOgImagesPage;
