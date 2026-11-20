import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/builders";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { getReactionCatalog } from "@/lib/reactions/catalog";
import { json } from "@/modules/reactions/reactions.schema";

import { adminReactionSchema } from "../reactions.schema";

export const listReactionsAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.reactions.canView,
  route: {
    method: "get",
    path: "/",
    description:
      "Every reaction in display order, enabled or not, with its roles and points (Admin only)",
    responses: {
      200: json(
        z.object({ reactions: z.array(adminReactionSchema) }),
        "Reactions",
      ),
      403: { description: "Access Denied" },
    },
  },
  handler: async c => {
    const catalog = await getReactionCatalog(c);

    return c.json(
      {
        reactions: catalog.map(reaction => ({
          allRoles: reaction.allRoles,
          code: reaction.code,
          enabled: reaction.enabled,
          fileId: reaction.fileId,
          icon: reaction.icon,
          id: reaction.id,
          image: reaction.image,
          kind: reaction.kind,
          points: reaction.points,
          position: reaction.position,
          posterFileId: reaction.posterFileId,
          roles: reaction.roles,
          title: reaction.title,
        })),
      },
      200,
    );
  },
});
