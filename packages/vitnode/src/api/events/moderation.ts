import { z } from "zod";

import { manifest } from "@/manifest";

import { defineEvent } from "../lib/event-definition";
import { eventDate } from "./wire";

const pluginId = manifest.id;

export const moderationReportActionEvent = defineEvent({
  pluginId,
  name: "moderation.report.action",
  payload: z.object({
    action: z.enum(["hide", "unhide"]),
    pluginId: z.string(),
    reportId: z.number().int(),
    targetId: z.string(),
    targetType: z.string(),
  }),
});

export const moderationReportAssignedEvent = defineEvent({
  pluginId,
  name: "moderation.report.assigned",
  payload: z.object({
    assigneeId: z.number().int().nullable(),
    previousAssigneeId: z.number().int().nullable(),
    reportId: z.number().int(),
  }),
});

export const moderationReportCreatedEvent = defineEvent({
  pluginId,
  name: "moderation.report.created",
  payload: z.object({
    pluginId: z.string(),
    reason: z.string(),
    reportId: z.number().int(),
    targetId: z.string(),
    targetType: z.string(),
  }),
});

export const moderationReportNoteDeletedEvent = defineEvent({
  pluginId,
  name: "moderation.report.note_deleted",
  payload: z.object({
    noteId: z.number().int(),
    reportId: z.number().int(),
  }),
});

export const moderationReportNoteUpdatedEvent = defineEvent({
  pluginId,
  name: "moderation.report.note_updated",
  payload: z.object({
    noteId: z.number().int(),
    reportId: z.number().int(),
  }),
});

export const moderationReportReopenedEvent = defineEvent({
  pluginId,
  name: "moderation.report.reopened",
  payload: z.object({ reportId: z.number().int() }),
});

export const moderationReportResolvedEvent = defineEvent({
  pluginId,
  name: "moderation.report.resolved",
  payload: z.object({
    reportId: z.number().int(),
    resolution: z.string(),
  }),
});

export const moderationReportReasonCreatedEvent = defineEvent({
  pluginId,
  name: "moderation.report_reason.created",
  payload: z.object({ code: z.string(), reasonId: z.number().int() }),
});

export const moderationReportReasonDeletedEvent = defineEvent({
  pluginId,
  name: "moderation.report_reason.deleted",
  payload: z.object({ code: z.string(), reasonId: z.number().int() }),
});

export const moderationReportReasonReorderedEvent = defineEvent({
  pluginId,
  name: "moderation.report_reason.reordered",
  payload: z.object({ reasonIds: z.array(z.number().int()) }),
});

export const moderationReportReasonUpdatedEvent = defineEvent({
  pluginId,
  name: "moderation.report_reason.updated",
  payload: z.object({ code: z.string(), reasonId: z.number().int() }),
});

export const moderationSanctionAppliedEvent = defineEvent({
  pluginId,
  name: "moderation.sanction.applied",
  payload: z.object({
    /** ISO string on the wire, a `Date` for listeners; `null` for an indefinite sanction. */
    endsAt: eventDate().nullable(),
    sanctionId: z.number().int(),
    source: z.enum(["manual", "threshold"]),
    thresholdId: z.number().int().nullable(),
    type: z.literal("suspension"),
    userId: z.number().int(),
    warningId: z.number().int().nullable(),
  }),
});

export const moderationSanctionRevokedEvent = defineEvent({
  pluginId,
  name: "moderation.sanction.revoked",
  payload: z.object({
    revokedById: z.number().int(),
    sanctionId: z.number().int(),
    userId: z.number().int(),
  }),
});

export const moderationWarningIssuedEvent = defineEvent({
  pluginId,
  name: "moderation.warning.issued",
  payload: z.object({
    issuedById: z.number().int(),
    pluginId: z.string().nullable(),
    points: z.number(),
    reasonId: z.number().int().nullable(),
    reportId: z.number().int().nullable(),
    targetId: z.string().nullable(),
    targetType: z.string().nullable(),
    userId: z.number().int(),
    warningId: z.number().int(),
  }),
});

export const moderationWarningRevokedEvent = defineEvent({
  pluginId,
  name: "moderation.warning.revoked",
  payload: z.object({
    revokedById: z.number().int(),
    userId: z.number().int(),
    warningId: z.number().int(),
  }),
});

export const moderationWarningReasonCreatedEvent = defineEvent({
  pluginId,
  name: "moderation.warning_reason.created",
  payload: z.object({ reasonId: z.number().int() }),
});

export const moderationWarningReasonUpdatedEvent = defineEvent({
  pluginId,
  name: "moderation.warning_reason.updated",
  payload: z.object({ reasonId: z.number().int() }),
});

export const moderationWarningThresholdCreatedEvent = defineEvent({
  pluginId,
  name: "moderation.warning_threshold.created",
  payload: z.object({ thresholdId: z.number().int() }),
});

export const moderationWarningThresholdDeletedEvent = defineEvent({
  pluginId,
  name: "moderation.warning_threshold.deleted",
  payload: z.object({ thresholdId: z.number().int() }),
});

export const moderationWarningThresholdUpdatedEvent = defineEvent({
  pluginId,
  name: "moderation.warning_threshold.updated",
  payload: z.object({ thresholdId: z.number().int() }),
});

/** Every `moderation.*` event core defines. */
export const moderationEventDefinitions = [
  moderationReportActionEvent,
  moderationReportAssignedEvent,
  moderationReportCreatedEvent,
  moderationReportNoteDeletedEvent,
  moderationReportNoteUpdatedEvent,
  moderationReportReopenedEvent,
  moderationReportResolvedEvent,
  moderationReportReasonCreatedEvent,
  moderationReportReasonDeletedEvent,
  moderationReportReasonReorderedEvent,
  moderationReportReasonUpdatedEvent,
  moderationSanctionAppliedEvent,
  moderationSanctionRevokedEvent,
  moderationWarningIssuedEvent,
  moderationWarningRevokedEvent,
  moderationWarningReasonCreatedEvent,
  moderationWarningReasonUpdatedEvent,
  moderationWarningThresholdCreatedEvent,
  moderationWarningThresholdDeletedEvent,
  moderationWarningThresholdUpdatedEvent,
];
