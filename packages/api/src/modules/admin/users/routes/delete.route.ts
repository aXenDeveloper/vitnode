import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/builders";
import { eraseAccount } from "@/lib/account-deletion/erase";
import {
  openAccountDeletion,
  scheduleAccountDeletion,
} from "@/lib/account-deletion/requests";
import { writeAuditLogBestEffort } from "@/lib/audit/write";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

import { assertCanEditAdminTarget } from "../lib/assert-edit-user-permission";
import {
  findTargetUserId,
  USER_NOT_FOUND,
  userNotFoundResponse,
  zodTargetUserIdParam,
} from "../lib/target-user";

export const deleteUserAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.users.canDelete,
  route: {
    method: "delete",
    description:
      "Delete a user's account (GDPR Art. 17). `immediately` erases it now; otherwise it is scheduled with the member's grace period and the member is emailed how to cancel. Never your own account (Admin only).",
    path: "/{id}",
    request: {
      params: z.object({ id: zodTargetUserIdParam }),
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              immediately: z.boolean().openapi({ example: true }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              filesKept: z.number().int(),
              scheduledAt: z.date().nullable(),
              status: z.enum(["completed", "scheduled"]),
            }),
          },
        },
        description: "Account erased or scheduled for deletion",
      },
      400: {
        content: {
          "application/json": { schema: z.object({ error: z.string() }) },
        },
        description: "Admins cannot delete their own account here",
      },
      403: { description: "Access Denied" },
      404: userNotFoundResponse,
      409: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string(), lastError: z.string() }),
          },
        },
        description:
          "Erasure failed; the account was kept and the request is retried hourly",
      },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const { immediately } = c.req.valid("json");
    const userId = await findTargetUserId(c, id);
    if (userId === null) return c.json(USER_NOT_FOUND, 404);

    const adminId = c.get("admin")?.user.id ?? null;
    if (adminId === userId) {
      return c.json({ error: "You cannot delete your own account" }, 400);
    }

    await assertCanEditAdminTarget(c, userId);

    if (!immediately) {
      const deletion = await scheduleAccountDeletion(c, {
        requestedById: adminId,
        source: "admin",
        userId,
      });
      await writeAuditLogBestEffort(c, {
        action: "user.deletion_scheduled",
        metadata: { scheduledAt: deletion.scheduledAt.toISOString() },
        target: { id: userId, type: "user" },
      });

      return c.json(
        {
          filesKept: 0,
          scheduledAt: deletion.scheduledAt,
          status: "scheduled" as const,
        },
        200,
      );
    }

    const { deletion } = await openAccountDeletion(c, {
      immediately: true,
      requestedById: adminId,
      source: "admin",
      userId,
    });
    const result = await eraseAccount(c, { deletionId: deletion.id, userId });

    if (result.status === "failed") {
      return c.json(
        {
          error: "Account erasure failed",
          lastError: result.error,
        },
        409,
      );
    }

    return c.json(
      {
        filesKept: result.filesKept,
        scheduledAt: null,
        status: "completed" as const,
      },
      200,
    );
  },
});
