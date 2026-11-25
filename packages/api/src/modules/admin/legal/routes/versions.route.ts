import { z } from "zod";

import { buildRoute } from "@/builders";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

import {
  zodAdminLegalVersionSummary,
  zodDocumentTypeParam,
} from "../legal.schema";
import { adminLegalVersionsOf, adminLegalVersionSummaries } from "../lib";

export const versionsLegalAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.legal.canView,
  route: {
    method: "get",
    description:
      "Every announced version of a legal document, newest first, with delivery and acceptance counts.",
    path: "/{documentType}/versions",
    request: { params: zodDocumentTypeParam },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ items: z.array(zodAdminLegalVersionSummary) }),
          },
        },
        description: "Version history",
      },
    },
  },
  handler: async c => {
    const { documentType } = c.req.valid("param");
    const rows = await adminLegalVersionsOf(c, documentType);

    return c.json({ items: await adminLegalVersionSummaries(c, rows) }, 200);
  },
});
