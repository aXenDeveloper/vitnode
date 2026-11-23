import { z } from "zod";

import { buildRoute } from "@/builders";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { renderRobotsTxt } from "@/lib/seo/serve.server";
import { loadSeoSettings } from "@/lib/seo/settings.server";

export const robotsPreviewAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.seo.canView,
  route: {
    method: "get",
    description: "The robots.txt the site serves right now, as text.",
    path: "/robots/preview",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ content: z.string(), offline: z.boolean() }),
          },
        },
        description: "robots.txt preview",
      },
    },
  },
  handler: async c => {
    const { body, offline } = await renderRobotsTxt(
      c,
      await loadSeoSettings(c),
    );

    return c.json({ content: body, offline }, 200);
  },
});
