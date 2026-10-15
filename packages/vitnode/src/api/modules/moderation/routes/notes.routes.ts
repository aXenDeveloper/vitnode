import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { buildRoute } from "@/api/builders";
import { requireModerator } from "@/api/lib/moderation/access";
import { core_moderation_report_events } from "@/database/moderation";

import { canChangeNote, loadReportNote } from "../lib/notes";
import {
  appendReportEvent,
  authorizeReport,
  reportError,
} from "../lib/reports";
import {
  errorSchema,
  json,
  reportIdParams,
  richNoteSchema,
} from "../lib/schema";

const noteParams = reportIdParams.extend({
  noteId: z.coerce.number().int().positive().openapi({ example: 1 }),
});

const noteResponses = {
  200: json(z.object({ ok: z.boolean() }), "Done"),
  400: { description: "Invalid input" },
  401: { description: "Sign in first" },
  403: json(
    errorSchema,
    "Not the note's author, and no permission for others' notes",
  ),
  404: json(
    errorSchema,
    "No such report or note, or not one this moderator may see",
  ),
};

export const editReportNoteRoute = buildRoute({
  route: {
    method: "post",
    path: "/reports/{id}/notes/{noteId}/edit",
    description:
      "Change an internal note. Authors edit their own notes; can_edit_notes edits anyone's",
    request: {
      params: noteParams,
      body: {
        content: {
          "application/json": { schema: z.object({ body: richNoteSchema }) },
        },
      },
    },
    responses: noteResponses,
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    const { id, noteId } = c.req.valid("param");
    const { body } = c.req.valid("json");
    const { report } = await authorizeReport(c, moderator, id);
    const note = await loadReportNote(c, report.id, noteId);
    if (!canChangeNote(c, moderator, report, note, "edit")) {
      throw reportError(403, { error: "forbidden" });
    }

    await c.get("db").transaction(async tx => {
      await tx
        .update(core_moderation_report_events)
        .set({
          data: {
            ...note.data,
            body,
            editedAt: new Date().toISOString(),
            editedById: moderator.user.id,
          },
        })
        .where(eq(core_moderation_report_events.id, note.id));
      await appendReportEvent(tx, {
        actorId: moderator.user.id,
        data: { after: body, before: note.data.body ?? null, noteId: note.id },
        reportId: report.id,
        type: "note_edited",
      });
    });

    await c.get("events").emit("moderation.report.note_updated", {
      noteId: note.id,
      reportId: report.id,
    });

    return c.json({ ok: true }, 200);
  },
});

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
    });

    await c.get("events").emit("moderation.report.note_deleted", {
      noteId: note.id,
      reportId: report.id,
    });

    return c.json({ ok: true }, 200);
  },
});
