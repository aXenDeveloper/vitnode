import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { resolveStaffPermissions } from "@/api/lib/check-staff-permission";
import { canOnReport, requireModerator } from "@/api/lib/moderation/access";
import { MODERATION_PERMISSIONS } from "@/lib/moderation/const";

import { listModeratorCandidates } from "../lib/candidates";
import { loadReportPeople } from "../lib/people";
import { authorizeReport } from "../lib/reports";
import { json, reportIdParams, reportPersonSchema } from "../moderation.schema";
import { mutationResponses } from "../report-workflow.schema";

export const reportAssigneesRoute = buildRoute({
  route: {
    method: "get",
    path: "/reports/{id}/assignees",
    description: "Moderators who may manage this report, for reassignment",
    request: { params: reportIdParams },
    responses: {
      200: json(z.array(reportPersonSchema), "Eligible moderators"),
      401: mutationResponses[401],
      403: mutationResponses[403],
      404: mutationResponses[404],
    },
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    const { id } = c.req.valid("param");
    const { report } = await authorizeReport(c, moderator, id, {
      manage: true,
    });
    const candidates = await listModeratorCandidates(c);

    const resolved = await Promise.all(
      candidates.map(async user => ({
        id: user.id,
        set: await resolveStaffPermissions(c, { type: "moderator", user }),
      })),
    );
    const eligible = resolved
      .filter(
        ({ set }) =>
          set.staff &&
          canOnReport(
            c,
            set,
            {
              pluginId: report.pluginId,
              scopeId: report.scopeId,
              targetType: report.targetType,
            },
            MODERATION_PERMISSIONS.manageReports,
          ),
      )
      .map(({ id }) => id);
    const people = await loadReportPeople(c, eligible);

    return c.json(
      eligible.flatMap(userId => {
        const person = people.get(userId);

        return person ? [person] : [];
      }),
      200,
    );
  },
});
