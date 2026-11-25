import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/builders";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

import { zodAdminLegalVersion, zodVersionIdParam } from "../legal.schema";
import { adminLegalVersion } from "../lib";

export const versionLegalAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.legal.canView,
  route: {
    method: "get",
    description:
      "One announced version with its content in every language, delivery status and acceptance count.",
    path: "/versions/{id}",
    request: { params: zodVersionIdParam },
    responses: {
      200: {
        content: { "application/json": { schema: zodAdminLegalVersion } },
        description: "Version",
      },
      404: { description: "No such version" },
    },
  },
  handler: async c => {
    const version = await adminLegalVersion(c, c.req.valid("param").id);
    if (!version) throw new HTTPException(404);

    return c.json(version, 200);
  },
});
