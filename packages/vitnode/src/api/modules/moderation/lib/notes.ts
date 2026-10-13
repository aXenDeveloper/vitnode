import type { Context } from "hono";

import { and, eq } from "drizzle-orm";

import type { ModeratorContext } from "@/api/lib/moderation/access";

import { canOnReport } from "@/api/lib/moderation/access";
import { core_moderation_report_events } from "@/database/moderation";
import { MODERATION_PERMISSIONS } from "@/lib/moderation/const";

import type { ReportRow } from "./reports";

import { reportError } from "./reports";

type NoteAction = "delete" | "edit";

const ANY_NOTE_PERMISSION: Record<NoteAction, string> = {
  delete: MODERATION_PERMISSIONS.deleteNotes,
  edit: MODERATION_PERMISSIONS.editNotes,
};

export const canChangeNote = (
  c: Context,
  moderator: ModeratorContext,
  report: Pick<ReportRow, "pluginId" | "scopeId" | "targetType">,
  note: { actorId: null | number },
  action: NoteAction,
): boolean => {
  const ref = {
    pluginId: report.pluginId,
    scopeId: report.scopeId,
    targetType: report.targetType,
  };
  if (
    !canOnReport(c, moderator.set, ref, MODERATION_PERMISSIONS.manageReports)
  ) {
    return false;
  }

  return (
    note.actorId === moderator.user.id ||
    canOnReport(c, moderator.set, ref, ANY_NOTE_PERMISSION[action])
  );
};

export const loadReportNote = async (
  c: Context,
  reportId: number,
  noteId: number,
) => {
  const [note] = await c
    .get("db")
    .select()
    .from(core_moderation_report_events)
    .where(
      and(
        eq(core_moderation_report_events.id, noteId),
        eq(core_moderation_report_events.reportId, reportId),
        eq(core_moderation_report_events.type, "note"),
      ),
    )
    .limit(1);
  if (!note) throw reportError(404, { error: "note_not_found" });

  return note;
};
