import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { userAuditLabel } from "@/api/lib/audit/labels";
import { writeAuditLog } from "@/api/lib/audit/write";
import { core_ai_user_overrides } from "@/database/ai";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

import { zodDecimalString } from "../ai.schema";

export const updateAiUserOverrideAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.ai.canManage,
  route: {
    method: "put",
    description:
      "Give one user an explicit AI exception: a different allowance, unlimited, or blocked.",
    path: "/access/users",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              blocked: z.boolean(),
              monthlyPoints: zodDecimalString.nullable(),
              unlimited: z.boolean(),
              userId: z.number().int(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ ok: z.literal(true) }) },
        },
        description: "Saved",
      },
    },
  },
  handler: async c => {
    const { userId, ...values } = c.req.valid("json");
    const label = await userAuditLabel(c, userId);
    await c.get("db").transaction(async tx => {
      await tx
        .insert(core_ai_user_overrides)
        .values({ userId, ...values })
        .onConflictDoUpdate({
          set: values,
          target: core_ai_user_overrides.userId,
        });
      await writeAuditLog(
        c,
        {
          action: "ai_access.user_override_saved",
          metadata: values,
          target: { id: userId, label, type: "user" },
        },
        tx,
      );
    });

    return c.json({ ok: true as const }, 200);
  },
});
