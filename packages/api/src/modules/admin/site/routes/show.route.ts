import { eq } from "drizzle-orm";

import { buildRoute } from "@/builders";
import { core_users } from "@/database/users";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { loadSiteStatus } from "@/lib/site-status.server";

import { zodSiteStatusAdmin } from "../site.schema";

export const showSiteStatusAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.site_status.canView,
  route: {
    method: "get",
    description:
      "The site status with its message in every language and who changed it last.",
    path: "/status",
    responses: {
      200: {
        content: { "application/json": { schema: zodSiteStatusAdmin } },
        description: "Site status",
      },
    },
  },
  handler: async c => {
    const status = await loadSiteStatus(c);
    const [changedBy] =
      status.changedById === null
        ? []
        : await c
            .get("db")
            .select({
              id: core_users.id,
              name: core_users.name,
              nameCode: core_users.nameCode,
            })
            .from(core_users)
            .where(eq(core_users.id, status.changedById))
            .limit(1);

    return c.json(
      {
        changedAt: status.changedAt,
        changedBy: changedBy ?? null,
        message: status.message,
        offline: status.offline,
        opensAt: status.opensAt,
        showCountdown: status.showCountdown,
      },
      200,
    );
  },
});
