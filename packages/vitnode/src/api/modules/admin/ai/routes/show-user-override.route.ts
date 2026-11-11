import { eq } from "drizzle-orm";
import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { core_ai_user_overrides } from "@/database/ai";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

import { decimalOrNull } from "../lib/decimal-or-null";

export const getAiUserOverrideAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.ai.canView,
  route: {
    method: "get",
    description: "One user's AI exception, or null when their roles apply.",
    path: "/access/users/{userId}",
    request: { params: z.object({ userId: z.coerce.number().int() }) },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              override: z
                .object({
                  blocked: z.boolean(),
                  monthlyPoints: z.string().nullable(),
                  unlimited: z.boolean(),
                })
                .nullable(),
            }),
          },
        },
        description: "AI exception of a user",
      },
    },
  },
  handler: async c => {
    const { userId } = c.req.valid("param");
    const [row] = await c
      .get("db")
      .select()
      .from(core_ai_user_overrides)
      .where(eq(core_ai_user_overrides.userId, userId));

    return c.json(
      {
        override: row
          ? {
              blocked: row.blocked,
              monthlyPoints: decimalOrNull(row.monthlyPoints),
              unlimited: row.unlimited,
            }
          : null,
      },
      200,
    );
  },
});
