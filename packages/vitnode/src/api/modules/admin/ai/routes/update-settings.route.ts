import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { saveAiSettings } from "@/api/lib/ai/settings-store";
import { writeAuditLog } from "@/api/lib/audit/write";
import { core_ai_settings } from "@/database/ai";
import { auditDiff } from "@/lib/audit/diff";

import { zodAiSettings } from "../schemas";

export const updateAiSettingsAdminRoute = buildRoute({
  adminStaffPermission: { module: "ai", permission: "can_manage" },
  route: {
    method: "put",
    description: "Update site-wide AI settings.",
    path: "/settings",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: zodAiSettings } },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ ok: z.literal(true) }) },
        },
        description: "Saved",
      },
      400: { description: "Automatic ALT needs a site budget" },
    },
  },
  handler: async c => {
    const body = c.req.valid("json");
    if (body.altEnabled && body.monthlyBudgetUsd === null) {
      throw new HTTPException(400, {
        message:
          "Set a monthly site budget before turning on automatic ALT text.",
      });
    }

    await c.get("db").transaction(async tx => {
      const [before] = await tx
        .select()
        .from(core_ai_settings)
        .where(eq(core_ai_settings.id, 1))
        .limit(1);
      await saveAiSettings(tx, body);

      const changes = auditDiff({
        after: body,
        before: before ?? null,
        include: Object.keys(body) as (keyof typeof body)[],
      });
      if (changes) {
        await writeAuditLog(
          c,
          {
            action: "settings.updated",
            changes,
            target: { id: "ai", label: "AI", type: "settings" },
          },
          tx,
        );
      }
    });

    return c.json({ ok: true as const }, 200);
  },
});
