import { and, eq, inArray, lte, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { buildQueueTask } from "@/builders";
import {
  core_legal_deliveries,
  core_legal_fanouts,
  core_legal_versions,
} from "@/database/legal";
import { legalVersionEffectiveEvent } from "@/events/legal";
import { buildCron } from "@/lib/cron";
import { legalChangesChannel } from "@/ws/legal";

import {
  runLegalFanout,
  runLegalSend,
  scheduleLegalFanout,
  scheduleLegalSend,
} from "./delivery.server";
import { invalidateLegalCaches } from "./state.server";

const versionPayload = z.object({ versionId: z.number().int().positive() });

/**
 * Builds a version's recipient list in batches of 500, resuming from the
 * stored cursor, then hands over to {@link legalSendTask}. Dispatched in the
 * same transaction as the announcement.
 */
export const legalFanoutTask = buildQueueTask({
  name: "legal-fanout",
  description:
    "Add every existing member to a legal document announcement's delivery list.",
  maxAttempts: 10,
  payload: versionPayload,
  handler: async (c, { versionId }) => {
    const { completed } = await runLegalFanout(c, versionId);
    await scheduleLegalSend(c, versionId);
    if (!completed) {
      await c
        .get("queue")
        .dispatch(legalFanoutTask, { versionId }, { priority: 5 });
    }
  },
});

/** Sends due announcement emails of a version and schedules its next run. */
export const legalSendTask = buildQueueTask({
  name: "legal-send",
  description: "Send a legal document announcement email to its recipients.",
  maxAttempts: 10,
  payload: versionPayload,
  handler: async (c, { versionId }) => {
    const { nextRunAt } = await runLegalSend(c, versionId);
    if (nextRunAt) {
      await c
        .get("queue")
        .dispatch(
          legalSendTask,
          { versionId },
          { availableAt: nextRunAt, priority: 5 },
        );
    }
  },
});

/**
 * Runs when a scheduled version takes effect: expires the cached timeline and
 * public pages, tells open tabs to refresh their legal state and emits
 * `legal.version.effective`.
 */
export const legalEffectiveTask = buildQueueTask({
  name: "legal-effective",
  description:
    "Refresh caches and open sessions when a legal version takes effect.",
  maxAttempts: 5,
  payload: versionPayload,
  handler: async (c, { versionId }) => {
    const [version] = await c
      .get("db")
      .select()
      .from(core_legal_versions)
      .where(eq(core_legal_versions.id, versionId))
      .limit(1);
    if (!version) return;

    await invalidateLegalCaches(c, [version.documentType]);
    c.get("realtime").broadcast(legalChangesChannel, { versionId });
    await c.get("events").emit(legalVersionEffectiveEvent, {
      documentType: version.documentType,
      requiresAcceptance: version.requiresAcceptance,
      version: version.version,
      versionId,
    });
  },
});

/**
 * Safety net for announcements whose queue chain broke (a task that ran out
 * of attempts, a lost worker): restarts unfinished fan-outs and due sends.
 * Every 10 minutes.
 */
export const legalDeliveryCron = buildCron({
  name: "legal-delivery",
  description:
    "Resume legal document announcement emails whose queue tasks stopped.",
  schedule: "*/10 * * * *",
  handler: async c => {
    const db = c.get("db");
    const unfinished = await db
      .select({ versionId: core_legal_fanouts.versionId })
      .from(core_legal_fanouts)
      .where(ne(core_legal_fanouts.status, "completed"));
    for (const { versionId } of unfinished) {
      await scheduleLegalFanout(c, versionId);
    }

    const due = await db
      .selectDistinct({ versionId: core_legal_deliveries.versionId })
      .from(core_legal_deliveries)
      .where(
        and(
          inArray(core_legal_deliveries.status, ["pending", "sending"]),
          lte(core_legal_deliveries.nextAttemptAt, sql`now()`),
        ),
      );
    for (const { versionId } of due) {
      await scheduleLegalSend(c, versionId);
    }
  },
});
