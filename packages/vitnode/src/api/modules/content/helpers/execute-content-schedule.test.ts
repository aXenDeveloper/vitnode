// @vitest-environment node
import type { SQL } from "drizzle-orm";
import type { Context } from "hono";

import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import { core_content_schedules } from "@/database/content";
import { testEditorialPostContentType } from "@/tests/content-fixtures";

import { executeContentSchedule } from "./execute-content-schedule";

const PLUGIN_ID = "@vitnode/example";

const dialect = new PgDialect();

const compile = (condition: SQL | undefined) => {
  if (!condition) throw new Error("Expected a condition.");

  return dialect.sqlToQuery(condition);
};

interface ScheduleRow {
  action: "publish" | "unpublish";
  contentTypeId: string;
  createdBy: null | number;
  generation: number;
  id: number;
  itemId: number;
  pluginId: string;
  scheduledFor: Date;
  status: "cancelled" | "completed" | "pending";
}

const pending: ScheduleRow = {
  action: "publish",
  contentTypeId: testEditorialPostContentType.id,
  createdBy: 3,
  generation: 1,
  id: 55,
  itemId: 7,
  pluginId: PLUGIN_ID,
  scheduledFor: new Date("2026-01-01T09:00:00.000Z"),
  status: "pending",
};

const row = {
  createdAt: new Date("2026-08-01T09:00:00.000Z"),
  id: 7,
  publishedAt: new Date("2026-08-05T12:00:00.000Z"),
  slug: "hello-world",
  status: "published",
  title: "Hello world",
  updatedAt: new Date("2026-08-05T12:00:00.000Z"),
  version: 4,
};

const outcome = {
  changed: true,
  changedFields: [],
  operation: "publish" as const,
  previousSlug: "hello-world",
  restoredFromRevisionId: null,
  revisionId: 90,
  row,
  version: 4,
};

type Handle = "db" | "tx";

interface Claim {
  condition: SQL | undefined;
  handle: Handle;
  lock: string;
  table: string;
}

interface Settlement {
  condition: SQL | undefined;
  handle: Handle;
  patch: Record<string, unknown>;
  table: string;
}

const harness = ({
  editorial,
  registered = true,
  schedule = pending,
  stillPending = true,
}: {
  editorial?: Partial<Record<"publish" | "unpublish", unknown>>;
  registered?: boolean;
  schedule?: null | ScheduleRow;
  stillPending?: boolean;
} = {}) => {
  const publish = vi.fn().mockResolvedValue(outcome);
  const unpublish = vi.fn().mockResolvedValue(outcome);

  const model = {
    definition: testEditorialPostContentType,
    editorialService: () => ({ publish, unpublish, ...editorial }),
  };

  const dispatch = vi.fn().mockResolvedValue({ id: 1 });
  const claims: Claim[] = [];
  const settlements: Settlement[] = [];
  let committed = false;

  const handleFor = (handle: Handle) => ({
    select: () => ({
      from: (table: typeof core_content_schedules) => ({
        where: (condition: SQL | undefined) => ({
          limit: () => ({
            for: async (lock: string) => {
              claims.push({
                condition,
                handle,
                lock,
                table: getTableName(table),
              });

              return await Promise.resolve(schedule ? [schedule] : []);
            },
          }),
        }),
      }),
    }),
    update: (table: typeof core_content_schedules) => ({
      set: (patch: Record<string, unknown>) => ({
        where: (condition: SQL | undefined) => ({
          returning: async () => {
            settlements.push({
              condition,
              handle,
              patch,
              table: getTableName(table),
            });

            return await Promise.resolve(stillPending ? [{ id: 55 }] : []);
          },
        }),
      }),
    }),
  });

  const tx = handleFor("tx");

  const db = {
    ...handleFor("db"),
    transaction: async (fn: (handle: typeof tx) => Promise<unknown>) => {
      const result = await fn(tx);
      committed = true;

      return result;
    },
  };

  const c = {
    get: (key: string) =>
      key === "db"
        ? db
        : key === "queue"
          ? { dispatch }
          : key === "core"
            ? {
                contentModels: registered
                  ? [{ model, pluginId: PLUGIN_ID }]
                  : [],
              }
            : undefined,
  } as unknown as Context;

  return {
    c,
    claims,
    committed: () => committed,
    dispatch,
    publish,
    settlements,
    tx,
    unpublish,
  };
};

/** The single argument every effects dispatch carries. */
const dispatchedPayload = (dispatch: ReturnType<typeof vi.fn>) =>
  dispatch.mock.calls[0][0] as {
    name: string;
    payload: Record<string, unknown>;
    pluginId: string;
    tx?: unknown;
  };

const completed = {
  completedAt: expect.any(Date),
  lastError: null,
  status: "completed",
};

describe("executeContentSchedule", () => {
  it("publishes, settles the schedule, and queues the announcements", async () => {
    const { c, dispatch, publish, settlements } = harness();

    const result = await executeContentSchedule(c, {
      generation: 1,
      scheduleId: 55,
    });

    expect(result.status).toBe("executed");
    expect(publish).toHaveBeenCalledTimes(1);
    expect(settlements).toHaveLength(1);
    expect(settlements[0].patch).toEqual(completed);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatchedPayload(dispatch).name).toBe("content-schedule-effects");
  });

  describe("one transaction, from the claim to the commit", () => {
    it("claims, transitions, settles and dispatches on the same handle", async () => {
      // The whole point of the fix. Every one of these ran against the same
      // `tx`, so the row lock `claimContentSchedule` takes is still held when
      // the transition commits - which is what makes a concurrent cancel wait
      // rather than succeed and then be ignored.
      const { c, claims, dispatch, publish, settlements, tx } = harness();

      await executeContentSchedule(c, { generation: 1, scheduleId: 55 });

      expect(claims).toMatchObject([
        {
          handle: "tx",
          lock: "update",
          table: getTableName(core_content_schedules),
        },
      ]);
      expect(publish.mock.calls[0][1]).toMatchObject({ tx });
      expect(settlements).toMatchObject([
        { handle: "tx", table: getTableName(core_content_schedules) },
      ]);
      expect(dispatchedPayload(dispatch).tx).toBe(tx);
    });

    it("dispatches the effects before the transaction commits", async () => {
      // If the queue row could land after the commit, a crash in between would
      // leave a published record nobody was ever told about.
      const { c, committed, dispatch } = harness();

      dispatch.mockImplementation(async () => {
        expect(committed()).toBe(false);

        return Promise.resolve({ id: 1 });
      });

      await executeContentSchedule(c, { generation: 1, scheduleId: 55 });

      expect(dispatch).toHaveBeenCalledTimes(1);
    });

    it("settles only while the schedule is still pending", async () => {
      // The guard that stops a stale worker overwriting `cancelled` with
      // `completed`.
      const { c, settlements } = harness();

      await executeContentSchedule(c, { generation: 1, scheduleId: 55 });

      expect(settlements[0].patch).toEqual(completed);
      expect(compile(settlements[0].condition).params).toEqual([55, "pending"]);
    });

    it("rolls the transition back when the schedule is no longer pending", async () => {
      // Structurally impossible while the lock is held - so if it happens the
      // lock was not held, and publishing a cancelled plan is the worse of the
      // two outcomes.
      const { c, dispatch } = harness({ stillPending: false });

      await expect(
        executeContentSchedule(c, { generation: 1, scheduleId: 55 }),
      ).rejects.toThrow(/no longer pending/);

      expect(dispatch).not.toHaveBeenCalled();
    });
  });

  it("runs as the system, never as a made-up user", async () => {
    const { c, publish } = harness();

    await executeContentSchedule(c, { generation: 1, scheduleId: 55 });

    expect(publish.mock.calls[0][1]).toMatchObject({
      actor: { type: "system", userId: null },
    });
  });

  describe("the effects payload", () => {
    it("names the person who booked it", async () => {
      // The actor is genuinely the system, so "on whose instruction" has to
      // come from somewhere else - and it is the whole point of the audit
      // trail.
      const { c, dispatch } = harness();

      await executeContentSchedule(c, { generation: 1, scheduleId: 55 });

      expect(dispatchedPayload(dispatch).payload).toMatchObject({
        contentTypeId: testEditorialPostContentType.id,
        itemId: 7,
        operation: "publish",
        pluginId: PLUGIN_ID,
        revisionId: 90,
        scheduleId: 55,
        scheduledBy: 3,
        version: 4,
      });
    });

    it("says the record was private before a publish", async () => {
      // Derived from the transition's own guard rather than read back outside
      // the lock: `publish` only changes a row that was not published.
      const { c, dispatch } = harness();

      await executeContentSchedule(c, { generation: 1, scheduleId: 55 });

      expect(dispatchedPayload(dispatch).payload.wasPublic).toBe(false);
    });

    it("says the record was public before an unpublish", async () => {
      const { c, dispatch, unpublish } = harness({
        schedule: { ...pending, action: "unpublish" },
      });

      await executeContentSchedule(c, { generation: 1, scheduleId: 55 });

      expect(unpublish).toHaveBeenCalledTimes(1);
      expect(dispatchedPayload(dispatch).payload.wasPublic).toBe(true);
    });

    it("is JSON, so the queue can store and replay it", async () => {
      const { c, dispatch } = harness();

      await executeContentSchedule(c, { generation: 1, scheduleId: 55 });

      const { row: stored } = dispatchedPayload(dispatch).payload as {
        row: Record<string, unknown>;
      };
      expect(stored.publishedAt).toBe("2026-08-05T12:00:00.000Z");
      expect(stored.title).toBe("Hello world");
    });

    it("is stamped with core, so the worker can find the handler", async () => {
      const { c, dispatch } = harness();

      await executeContentSchedule(c, { generation: 1, scheduleId: 55 });

      expect(dispatchedPayload(dispatch).pluginId).toBe("@vitnode/core");
    });
  });

  describe("no-ops", () => {
    it.each([
      { schedule: null, state: "gone" },
      {
        schedule: { ...pending, status: "cancelled" as const },
        state: "cancelled",
      },
      { schedule: { ...pending, generation: 2 }, state: "superseded" },
      {
        schedule: {
          ...pending,
          scheduledFor: new Date(Date.now() + 60 * 60 * 1000),
        },
        state: "not yet due",
      },
    ])("does nothing when the row is $state", async ({ schedule }) => {
      const { c, dispatch, publish, settlements } = harness({ schedule });

      const result = await executeContentSchedule(c, {
        generation: 1,
        scheduleId: 55,
      });

      expect(result.status).toBe("skipped");
      expect(publish).not.toHaveBeenCalled();
      // The load-bearing part: a superseded task must not touch search or the
      // cache, or a cancelled plan would still expire a live page.
      expect(dispatch).not.toHaveBeenCalled();
      expect(settlements).toEqual([]);
    });

    it("does nothing more when the record is already published", async () => {
      const { c, dispatch, settlements } = harness({
        editorial: {
          publish: vi.fn().mockResolvedValue({ ...outcome, changed: false }),
        },
      });

      const result = await executeContentSchedule(c, {
        generation: 1,
        scheduleId: 55,
      });

      expect(result.status).toBe("skipped");
      expect(dispatch).not.toHaveBeenCalled();
      // Still settled, or it would be retried forever for a record that is
      // already in the state the schedule wanted.
      expect(settlements).toHaveLength(1);
      expect(settlements[0].patch).toEqual(completed);
      expect(compile(settlements[0].condition).params).toEqual([55, "pending"]);
    });

    it("does nothing when the record was deleted first", async () => {
      const { c, dispatch } = harness({
        editorial: { publish: vi.fn().mockResolvedValue(null) },
      });

      const result = await executeContentSchedule(c, {
        generation: 1,
        scheduleId: 55,
      });

      expect(result.status).toBe("skipped");
      expect(dispatch).not.toHaveBeenCalled();
    });
  });

  it("cancels rather than retrying when the content type is gone", async () => {
    // A plugin removed, or `editorial` turned off. An error every ten minutes
    // forever is not a useful way to report a config change.
    const { c, dispatch, settlements } = harness({ registered: false });

    const result = await executeContentSchedule(c, {
      generation: 1,
      scheduleId: 55,
    });

    expect(result.status).toBe("unregistered");
    expect(settlements).toHaveLength(1);
    expect(settlements[0].patch).toMatchObject({
      lastError: expect.stringContaining(testEditorialPostContentType.id),
      status: "cancelled",
    });
    expect(compile(settlements[0].condition).params).toEqual([55, "pending"]);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("records the error and rethrows a real failure", async () => {
    // This one *is* worth retrying, and the queue's backoff is the policy.
    const { c, settlements } = harness({
      editorial: {
        publish: vi.fn().mockRejectedValue(new Error("deadlock detected")),
      },
    });

    await expect(
      executeContentSchedule(c, { generation: 1, scheduleId: 55 }),
    ).rejects.toThrow("deadlock detected");

    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toMatchObject({
      handle: "db",
      patch: { lastError: "deadlock detected" },
    });
    // Left pending, so the AdminCP shows it as overdue rather than done.
    expect(settlements[0].patch).not.toHaveProperty("status");
    expect(compile(settlements[0].condition).params).toEqual([55, "pending"]);
  });

  it("claims the booked row for the generation the task carries", async () => {
    const { c, claims } = harness({ schedule: { ...pending, generation: 4 } });

    const result = await executeContentSchedule(c, {
      generation: 4,
      scheduleId: 55,
    });

    expect(result.status).toBe("executed");
    expect(compile(claims[0].condition).params).toEqual([55]);
  });
});
