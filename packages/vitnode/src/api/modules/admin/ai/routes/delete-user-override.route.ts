import { eq } from "drizzle-orm";
import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { userAuditLabel } from "@/api/lib/audit/labels";
import { writeAuditLog } from "@/api/lib/audit/write";
import { core_ai_user_overrides } from "@/database/ai";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

export const deleteAiUserOverrideAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.ai.canManage,
  route: {
    method: "delete",
    description: "Remove a user's AI exception; their roles apply again.",
    path: "/access/users",
    request: { query: z.object({ userId: z.coerce.number().int() }) },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ ok: z.literal(true) }) },
        },
        description: "Removed",
      },
    },
  },
  handler: async c => {
    const { userId } = c.req.valid("query");
    const label = await userAuditLabel(c, userId);
    await c.get("db").transaction(async tx => {
      const removed = await tx
        .delete(core_ai_user_overrides)
        .where(eq(core_ai_user_overrides.userId, userId))
        .returning({ userId: core_ai_user_overrides.userId });
      if (removed.length === 0) return;

      await writeAuditLog(
        c,
        {
          action: "ai_access.user_override_removed",
          target: { id: userId, label, type: "user" },
        },
        tx,
      );
    });

    return c.json({ ok: true as const }, 200);
  },
});
