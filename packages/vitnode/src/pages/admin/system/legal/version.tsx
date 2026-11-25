import { notFound } from "@tanstack/react-router";

import type { PluginRoutePageProps } from "@/routing";
import type { AdminLegalVersionRouteData } from "@/tanstack/admin/legal/route";

import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import {
  loadAdminLegalVersionRoute,
  parseLegalDocumentType,
} from "@/tanstack/admin/legal/route";
import { AdminLegalVersionRouteContent } from "@/tanstack/admin/legal/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminLegalVersionPage = ({
  loaderData,
}: PluginRoutePageProps<AdminLegalVersionRouteData>) => (
  <AdminLegalVersionRouteContent {...loaderData} />
);

export const route = defineAdminRoute<AdminLegalVersionRouteData>({
  load: async ({ context, params, t }) => {
    const id = Number(params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      // oxlint-disable-next-line typescript/only-throw-error
      throw notFound();
    }

    return await loadAdminLegalVersionRoute({
      ...context,
      documentType: parseLegalDocumentType(params.documentType),
      id,
      t,
    });
  },
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({ segments: ["core", "system", "legal"] }),
});

export default AdminLegalVersionPage;
