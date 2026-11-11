import type { Context } from "hono";
import type { z } from "zod";

import { writeAuditLogBestEffort } from "@/api/lib/audit/write";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

/** The danger-zone operations act on every member at once, so each is recorded. */
export const auditDanger = async (
  c: Context,
  operation: string,
): Promise<void> => {
  await writeAuditLogBestEffort(c, {
    action: `notifications.${operation}`,
    target: { label: "Notifications", type: "settings", id: "notifications" },
  });
};

export const canManageNotifications =
  coreStaffPermissions.admin.notifications.canManage;

export const dangerResponses = <T extends z.ZodType>(
  schema: T,
  description: string,
) =>
  ({
    200: { content: { "application/json": { schema } }, description },
    403: { description: "Access Denied" },
  }) as const;
