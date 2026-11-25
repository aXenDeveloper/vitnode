import type { PluginRoutePageProps } from "@/routing";
import type { AdminLegalDocumentRouteData } from "@/tanstack/admin/legal/route";

import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import {
  loadAdminLegalDocumentRoute,
  parseLegalDocumentType,
} from "@/tanstack/admin/legal/route";
import { AdminLegalDocumentRouteContent } from "@/tanstack/admin/legal/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminLegalDocumentPage = ({
  loaderData,
}: PluginRoutePageProps<AdminLegalDocumentRouteData>) => (
  <AdminLegalDocumentRouteContent {...loaderData} />
);

export const route = defineAdminRoute<AdminLegalDocumentRouteData>({
  load: async ({ context, params, t }) =>
    await loadAdminLegalDocumentRoute({
      ...context,
      documentType: parseLegalDocumentType(params.documentType),
      t,
    }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({ segments: ["core", "system", "legal"] }),
});

export default AdminLegalDocumentPage;
