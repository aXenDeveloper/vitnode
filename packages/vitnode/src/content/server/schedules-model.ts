import type { Context } from "hono";

import { and, desc, eq, inArray, lt, notInArray, sql } from "drizzle-orm";

import type {
  ContentSchedule,
  ContentScheduleAction,
  ContentScheduleStatus,
} from "../schedules";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentDatabase } from "./service";

import { core_content_schedules } from "../../database/content";
import { core_users } from "../../database/users";
import { CONTENT_QUEUE_TASK_SCHEDULE, CONTENT_SCHEDULE_CODES } from "../const";
import { ContentScheduleError } from "../errors";
import { contentScheduleTimingError } from "../schedules";

/** A schedule row claimed for execution, with everything the handler needs. */
export interface ClaimedContentSchedule {
  action: ContentScheduleAction;
  contentTypeId: string;
  createdBy: null | number;
  id: number;
  itemId: number;
  pluginId: string;
}

export const claimContentSchedule = async (
  tx: ContentDatabase,
  {
    generation,
    now = new Date(),
    scheduleId,
  }: {
    generation: number;
    now?: Date;
    scheduleId: number;
  },
): Promise<ClaimedContentSchedule | null> => {
  const [row] = await tx
    .select({
      action: core_content_schedules.action,
      contentTypeId: core_content_schedules.contentTypeId,
      createdBy: core_content_schedules.createdBy,
      generation: core_content_schedules.generation,
      id: core_content_schedules.id,
      itemId: core_content_schedules.itemId,
      pluginId: core_content_schedules.pluginId,
      scheduledFor: core_content_schedules.scheduledFor,
      status: core_content_schedules.status,
    })
    .from(core_content_schedules)
    .where(eq(core_content_schedules.id, scheduleId))
    .limit(1)
    .for("update");

  if (!row) return null;
  if (row.status !== "pending") return null;
  if (row.generation !== generation) return null;
  if (row.scheduledFor.getTime() > now.getTime()) return null;

  return {
    action: row.action,
    contentTypeId: row.contentTypeId,
    createdBy: row.createdBy,
    id: row.id,
    itemId: row.itemId,
    pluginId: row.pluginId,
  };
};

export const settleContentSchedule = async (
  db: ContentDatabase,
  scheduleId: number,
  patch: {
    /** Only write when the row still holds this status. */
    expectedStatus?: ContentScheduleStatus;
    lastError?: null | string;
    status?: "cancelled" | "completed";
  },
): Promise<boolean> => {
  const rows = await db
    .update(core_content_schedules)
    .set({
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.status === "completed" ? { completedAt: new Date() } : {}),
      ...(patch.lastError === undefined ? {} : { lastError: patch.lastError }),
    })
    .where(
      patch.expectedStatus === undefined
        ? eq(core_content_schedules.id, scheduleId)
        : and(
            eq(core_content_schedules.id, scheduleId),
            eq(core_content_schedules.status, patch.expectedStatus),
          ),
    )
    .returning({ id: core_content_schedules.id });

  return rows.length > 0;
};

export const recordContentScheduleEffectsError = async (
  db: ContentDatabase,
  scheduleId: number,
  effectsError: null | string,
): Promise<void> => {
  await db
    .update(core_content_schedules)
    .set({ effectsError })
    .where(eq(core_content_schedules.id, scheduleId));
};

export interface ContentSchedulesModel {
  cancel: (
    itemId: number,
    scheduleId: number,
  ) => Promise<null | { action: ContentScheduleAction }>;
  /** Pending and recent schedules for one record, newest first. */
  listForItem: (itemId: number) => Promise<ContentSchedule[]>;
  /** Pending rows only, for the ordering rule. */
  pendingForItem: (
    itemId: number,
    tx?: ContentDatabase,
  ) => Promise<{ action: ContentScheduleAction; scheduledFor: Date }[]>;
  recordError: (scheduleId: number, message: string) => Promise<void>;
  /**
   * Cancels any pending schedule for this `(item, action)` and inserts a new
   * one, in one transaction with its queue row.
   */
  schedule: (input: {
    action: ContentScheduleAction;
    actorUserId: null | number;
    itemId: number;
    now?: Date;
    scheduledFor: Date;
  }) => Promise<{ generation: number; id: number; scheduledFor: Date }>;
}

/** How many past schedules the AdminCP panel shows alongside the pending ones. */
const HISTORY_LIMIT = 10;

export const createContentSchedulesModel = ({
  c,
  definition,
  pluginId,
}: {
  c: Context;
  definition: AnyContentTypeDefinition;
  pluginId: string;
}): ContentSchedulesModel => {
  const contentTypeId = definition.id;

  const scope = (itemId: number) =>
    and(
      eq(core_content_schedules.pluginId, pluginId),
      eq(core_content_schedules.contentTypeId, contentTypeId),
      eq(core_content_schedules.itemId, itemId),
    );

  const pendingForItem = async (itemId: number, tx?: ContentDatabase) =>
    await (tx ?? c.get("db"))
      .select({
        action: core_content_schedules.action,
        scheduledFor: core_content_schedules.scheduledFor,
      })
      .from(core_content_schedules)
      .where(and(scope(itemId), eq(core_content_schedules.status, "pending")));

  return {
    cancel: async (itemId, scheduleId) => {
      const [row] = await c
        .get("db")
        .update(core_content_schedules)
        .set({ status: "cancelled" })
        .where(
          and(
            scope(itemId),
            eq(core_content_schedules.id, scheduleId),
            // Only a pending one can be cancelled. Re-cancelling a completed
            // schedule would rewrite history to say it never ran.
            eq(core_content_schedules.status, "pending"),
          ),
        )
        .returning({ action: core_content_schedules.action });

      return row ?? null;
    },

    listForItem: async itemId => {
      const rows = await c
        .get("db")
        .select({
          action: core_content_schedules.action,
          actorName: core_users.name,
          completedAt: core_content_schedules.completedAt,
          createdAt: core_content_schedules.createdAt,
          createdBy: core_content_schedules.createdBy,
          effectsError: core_content_schedules.effectsError,
          id: core_content_schedules.id,
          lastError: core_content_schedules.lastError,
          scheduledFor: core_content_schedules.scheduledFor,
          status: core_content_schedules.status,
        })
        .from(core_content_schedules)
        .leftJoin(
          core_users,
          eq(core_users.id, core_content_schedules.createdBy),
        )
        .where(scope(itemId))
        // Pending first whatever their date, then the rest newest-first: the
        // panel is answering "what is going to happen" before "what happened".
        .orderBy(
          sql`case when ${core_content_schedules.status} = 'pending' then 0 else 1 end`,
          desc(core_content_schedules.scheduledFor),
        )
        .limit(HISTORY_LIMIT);

      return rows;
    },

    pendingForItem,

    schedule: async ({
      action,
      actorUserId,
      itemId,
      now = new Date(),
      scheduledFor,
    }) => {
      // Belt and braces: the route only exists for a schedulable content type,
      // so this can only fire on a direct call - which is exactly when a clear
      // error beats a confusing one.
      if (!definition.editorial.scheduling.enabled) {
        throw new ContentScheduleError(
          `This content type has no scheduling, so there is no "${action}" to schedule.`,
          { code: CONTENT_SCHEDULE_CODES.unsupported, contentTypeId },
        );
      }

      return await c.get("db").transaction(async tx => {
        const pending = await pendingForItem(itemId, tx);

        const timing = contentScheduleTimingError({
          action,
          now,
          // The row about to be replaced is not a constraint on its replacement.
          pending: pending.filter(entry => entry.action !== action),
          scheduledFor,
        });
        if (timing) {
          throw new ContentScheduleError(
            timing === CONTENT_SCHEDULE_CODES.order
              ? "An unpublish has to be scheduled after the publish that is already pending."
              : "That time has already passed.",
            { code: timing, contentTypeId },
          );
        }

        // Cancel-then-insert rather than update: the old row stays in the
        // history as a cancelled plan, so "we moved it twice" is recoverable.
        const [previous] = await tx
          .update(core_content_schedules)
          .set({ status: "cancelled" })
          .where(
            and(
              scope(itemId),
              eq(core_content_schedules.action, action),
              eq(core_content_schedules.status, "pending"),
            ),
          )
          .returning({ generation: core_content_schedules.generation });

        const generation = (previous?.generation ?? 0) + 1;

        const [row] = await tx
          .insert(core_content_schedules)
          .values({
            action,
            contentTypeId,
            createdBy: actorUserId,
            generation,
            itemId,
            pluginId,
            scheduledFor,
          })
          .returning({ id: core_content_schedules.id });

        // Dispatched inside the transaction, so a schedule row can never exist
        // without the task that executes it - and the task carries a pointer
        // rather than data, because every value is re-read under a lock anyway.
        await c.get("queue").dispatch({
          availableAt: scheduledFor,
          name: CONTENT_QUEUE_TASK_SCHEDULE,
          payload: { generation, scheduleId: row.id },
          // Core owns the handler. Without this the row would be stamped with
          // the requesting plugin's id and nothing would ever claim it.
          pluginId: "@vitnode/core",
          tx,
        });

        return { generation, id: row.id, scheduledFor };
      });
    },

    recordError: async (scheduleId, message) => {
      await c
        .get("db")
        .update(core_content_schedules)
        .set({ lastError: message })
        .where(eq(core_content_schedules.id, scheduleId));
    },
  };
};

/**
 * Removes schedules that no longer describe anything.
 *
 * Two sweeps, both keyed by data rather than by a registry lookup at write
 * time: settled rows past the retention window, and rows for a content type
 * that is no longer registered at all - a plugin removed, or `scheduling`
 * turned off.
 */
export const pruneContentSchedules = async ({
  db,
  knownContentTypeIds,
  olderThan,
}: {
  db: ContentDatabase;
  knownContentTypeIds: string[];
  olderThan: Date;
}): Promise<{ orphaned: number; settled: number }> => {
  const settled = await db
    .delete(core_content_schedules)
    .where(
      and(
        inArray(core_content_schedules.status, ["cancelled", "completed"]),
        lt(core_content_schedules.updatedAt, olderThan),
      ),
    )
    .returning({ id: core_content_schedules.id });

  // An empty list genuinely means "no content type schedules any more", so
  // every remaining row is an orphan. `notInArray` with an empty array is not
  // valid SQL, hence the branch rather than a clever one-liner.
  const orphaned = await db
    .delete(core_content_schedules)
    .where(
      knownContentTypeIds.length === 0
        ? sql`true`
        : notInArray(core_content_schedules.contentTypeId, knownContentTypeIds),
    )
    .returning({ id: core_content_schedules.id });

  return { orphaned: orphaned.length, settled: settled.length };
};
