import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { requireModerator } from "@/api/lib/moderation/access";

import { recordReportAudit } from "../lib/audit";
import { appendReportEvent, authorizeReport } from "../lib/reports";
import { json, reportIdParams, richNoteSchema } from "../moderation.schema";
import { body, mutationResponses } from "../report-workflow.schema";

export const noteReportRoute = buildRoute({
  route: {
    method: "post",
    path: "/reports/{id}/notes",
    description:
      "Add an internal note to the report's timeline. Notes are visible to moderators only",
    request: {
      params: reportIdParams,
      ...body(z.object({ body: richNoteSchema })),
    },
    responses: {
      201: json(z.object({ ok: z.boolean() }), "Note added"),
      400: mutationResponses[400],
      401: mutationResponses[401],
      403: mutationResponses[403],
      404: mutationResponses[404],
    },
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    const { id } = c.req.valid("param");
    const { body: note } = c.req.valid("json");
    const { report } = await authorizeReport(c, moderator, id, {
      manage: true,
    });

    await c.get("db").transaction(async tx => {
      await appendReportEvent(tx, {
        actorId: moderator.user.id,
        data: { body: note },
        reportId: report.id,
        type: "note",
      });
      // That a note was added - its text stays in the report's own timeline,
      // behind the report's own permissions.
      await recordReportAudit(c, tx, report, { action: "note_added" });
    });

    return c.json({ ok: true }, 201);
  },
});
