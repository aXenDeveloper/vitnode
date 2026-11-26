import z from "zod";

import { buildRoute } from "@/builders";
import { queueCleanedEvent } from "@/events/queue";
import { writeAuditLogBestEffort } from "@/lib/audit/write";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import {
  cleanQueueTasks,
  QUEUE_CLEAN_SCOPES,
} from "@/modules/queue/lib/process-queue-tasks";

export const cleanQueueTasksRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.queue.canClean,
  route: {
    method: "post",
    description:
      "Permanently delete finished queue tasks now: only failed ones, or every completed and failed one. Pending and processing tasks are kept.",
    path: "/clean",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({ scope: z.enum(QUEUE_CLEAN_SCOPES) }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ deleted: z.number().int().nonnegative() }),
          },
        },
        description: "Queue cleaned",
      },
    },
  },
  handler: async c => {
    const { scope } = c.req.valid("json");
    const deleted = await cleanQueueTasks(c, scope);

    await writeAuditLogBestEffort(c, {
      action: "queue.cleaned",
      metadata: { deleted, scope },
      target: { id: "queue", label: "Queue", type: "settings" },
    });
    await c.get("events").emit(queueCleanedEvent, {
      cleanedById: c.get("admin")?.user.id ?? null,
      deleted,
      scope,
    });

    return c.json({ deleted }, 200);
  },
});
