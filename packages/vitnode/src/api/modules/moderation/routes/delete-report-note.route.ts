import { eq } from "drizzle-orm";

import { buildRoute } from "@/api/builders";
import { moderationReportNoteDeletedEvent } from "@/api/events/moderation";
import { requireModerator } from "@/api/lib/moderation/access";
import { core_moderation_report_events } from "@/database/moderation";

import { recordReportAudit } from "../lib/audit";
import { canChangeNote, loadReportNote } from "../lib/notes";
import {
  appendReportEvent,
  authorizeReport,
  reportError,
} from "../lib/reports";
import { noteParams, noteResponses } from "../report-notes.schema";

export const deleteReportNoteRoute = buildRoute({
  route: {
    method: "post",
    path: "/reports/{id}/notes/{noteId}/delete",
    description:
      "Remove an internal note. Authors delete their own notes; can_delete_notes deletes anyone's",
    request: { params: noteParams },
    responses: noteResponses,
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    const { id, noteId } = c.req.valid("param");
    const { report } = await authorizeReport(c, moderator, id);
    const note = await loadReportNote(c, report.id, noteId);
    if (!canChangeNote(c, moderator, report, note, "delete")) {
      throw reportError(403, { error: "forbidden" });
    }

    await c.get("db").transaction(async tx => {
      await tx
        .delete(core_moderation_report_events)
        .where(eq(core_moderation_report_events.id, note.id));
      await appendReportEvent(tx, {
        actorId: moderator.user.id,
        data: { before: note.data.body ?? null, noteId: note.id },
        reportId: report.id,
        type: "note_deleted",
      });
      await recordReportAudit(c, tx, report, {
        action: "note_deleted",
        metadata: { noteAuthorId: note.actorId, noteId: note.id },
      });
    });

    await c.get("events").emit(moderationReportNoteDeletedEvent, {
      noteId: note.id,
      reportId: report.id,
    });

    return c.json({ ok: true }, 200);
  },
});
