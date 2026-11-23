import { buildRoute } from "@/builders";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

import { readSeoAdminSettings } from "../admin-settings.server";
import { zodSeoAdminSettings } from "../seo.schema";

export const showSeoSettingsAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.seo.canView,
  route: {
    method: "get",
    description:
      "The SEO settings with their defaults, every registered sitemap source with its URL count, and what the robots.txt preview needs.",
    path: "/settings",
    responses: {
      200: {
        content: { "application/json": { schema: zodSeoAdminSettings } },
        description: "SEO settings",
      },
    },
  },
  handler: async c => c.json(await readSeoAdminSettings(c), 200),
});
