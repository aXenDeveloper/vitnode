import { buildRoute } from "@/builders";
import { writeAuditLog } from "@/lib/audit/write";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { queueReputationRecount } from "@/modules/reactions/tasks/recount-reputation.task";

export const recountReputationAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.reactions.canManage,
  route: {
    method: "post",
    path: "/recount",
    description:
      "Queue a recount of every member's reputation from the current points of the reactions they received (Admin only)",
    responses: {
      202: { description: "Recount queued" },
      403: { description: "Access Denied" },
    },
  },
  handler: async c => {
    await queueReputationRecount(c);
    await writeAuditLog(c, {
      action: "reaction.reputation_recounted",
      target: { type: "settings" },
    });

    return c.body(null, 202);
  },
});
