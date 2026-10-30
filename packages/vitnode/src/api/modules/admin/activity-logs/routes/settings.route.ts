import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { loadAuditSettings, saveAuditSettings } from "@/api/lib/audit/settings";
import { writeAuditLog } from "@/api/lib/audit/write";
import { AUDIT_RETENTION_DAYS_OPTIONS } from "@/lib/audit/const";
import { auditDiff } from "@/lib/audit/diff";

const zodSettings = z.object({
  retentionDays: z
    .number()
    .int()
    .refine(
      value =>
        (AUDIT_RETENTION_DAYS_OPTIONS as readonly number[]).includes(value),
      { message: "Choose one of the offered retention periods." },
    )
    .openapi({ example: 365 }),
});

export const activityLogSettingsAdminRoute = buildRoute({
  adminStaffPermission: { module: "activity_logs", permission: "can_view" },
  route: {
    method: "get",
    path: "/settings",
    description: "How long Activity Logs entries are kept",
    responses: {
      200: {
        content: { "application/json": { schema: zodSettings } },
        description: "The settings",
      },
    },
  },
  handler: async c => c.json(await loadAuditSettings(c.get("db")), 200),
});

export const updateActivityLogSettingsAdminRoute = buildRoute({
  adminStaffPermission: {
    module: "activity_logs",
    permission: "can_manage_retention",
  },
  route: {
    method: "put",
    path: "/settings",
    description:
      "Change how long Activity Logs entries are kept. The daily retention job deletes what is older",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: zodSettings } },
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: zodSettings } },
        description: "Saved",
      },
    },
  },
  handler: async c => {
    const body = c.req.valid("json");
    await c.get("db").transaction(async tx => {
      const before = await loadAuditSettings(tx);
      await saveAuditSettings(tx, body);
      const changes = auditDiff({ after: body, before });
      if (changes) {
        await writeAuditLog(
          c,
          {
            action: "audit_settings.updated",
            changes,
            target: {
              id: "activity_logs",
              label: "Activity Logs",
              type: "settings",
            },
          },
          tx,
        );
      }
    });

    return c.json(body, 200);
  },
});
