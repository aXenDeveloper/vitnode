// @vitest-environment node
import type { Context } from "hono";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { testEditorialPostContentType } from "@/tests/content-fixtures";

const claimContentSchedule = vi.fn();
const settleContentSchedule = vi.fn();

vi.mock("@/content/server/schedules-model", () => ({
  claimContentSchedule: (...args: unknown[]) => claimContentSchedule(...args),
  settleContentSchedule: (...args: unknown[]) => settleContentSchedule(...args),
}));

const { executeContentSchedule } = await import("./execute-content-schedule");

const PLUGIN_ID = "@vitnode/example";

const claimed = {
  action: "publish" as const,
  contentTypeId: testEditorialPostContentType.id,
  createdBy: 3,
  id: 55,
  itemId: 7,
  pluginId: PLUGIN_ID,
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

const harness = ({
  editorial,
  registered = true,
}: {
  editorial?: Partial<Record<"publish" | "unpublish", unknown>>;
  registered?: boolean;
} = {}) => {
  const publish = vi.fn().mockResolvedValue(outcome);
  const unpublish = vi.fn().mockResolvedValue(outcome);

  const model = {
    definition: testEditorialPostContentType,
    editorialService: () => ({ publish, unpublish, ...editorial }),
  };

  const dispatch = vi.fn().mockResolvedValue({ id: 1 });
  let committed = false;

  const db = {
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const result = await fn({ tx: true });
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

  return { c, committed: () => committed, dispatch, publish, unpublish };
};

/** The single argument every effects dispatch carries. */
const dispatchedPayload = (dispatch: ReturnType<typeof vi.fn>) =>
  dispatch.mock.calls[0][0] as {
    name: string;
    payload: Record<string, unknown>;
    pluginId: string;
    tx?: unknown;
  };

beforeEach(() => {
  vi.clearAllMocks();
  settleContentSchedule.mockResolvedValue(true);
});

describe("executeContentSchedule", () => {
  it("publishes, settles the schedule, and queues the announcements", async () => {
    claimContentSchedule.mockResolvedValue(claimed);
    const { c, dispatch, publish } = harness();

    const result = await executeContentSchedule(c, {
      generation: 1,
      scheduleId: 55,
    });

    expect(result.status).toBe("executed");
    expect(publish).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatchedPayload(dispatch).name).toBe("content-schedule-effects");
  });

  describe("one transaction, from the claim to the commit", () => {
    it("claims, transitions, settles and dispatches on the same handle", async () => {
      // The whole point of the fix. Every one of these ran against the same
      // `tx`, so the row lock `claimContentSchedule` takes is still held when
      // the transition commits - which is what makes a concurrent cancel wait
      // rather than succeed and then be ignored.
      claimContentSchedule.mockResolvedValue(claimed);
      const { c, dispatch, publish } = harness();

      await executeContentSchedule(c, { generation: 1, scheduleId: 55 });

      const tx = { tx: true };
      expect(claimContentSchedule).toHaveBeenCalledWith(tx, expect.anything());
      expect(publish.mock.calls[0][1]).toMatchObject({ tx });
      expect(settleContentSchedule).toHaveBeenCalledWith(
        tx,
        55,
        expect.anything(),
      );
      expect(dispatchedPayload(dispatch).tx).toEqual(tx);
    });

    it("dispatches the effects before the transaction commits", async () => {
      // If the queue row could land after the commit, a crash in between would
      // leave a published record nobody was ever told about.
      claimContentSchedule.mockResolvedValue(claimed);
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
      claimContentSchedule.mockResolvedValue(claimed);
      const { c } = harness();

      await executeContentSchedule(c, { generation: 1, scheduleId: 55 });

      expect(settleContentSchedule).toHaveBeenCalledWith(
        expect.anything(),
        55,
        {
          expectedStatus: "pending",
          lastError: null,
          status: "completed",
        },
      );
    });

    it("rolls the transition back when the schedule is no longer pending", async () => {
      // Structurally impossible while the lock is held - so if it happens the
      // lock was not held, and publishing a cancelled plan is the worse of the
      // two outcomes.
      claimContentSchedule.mockResolvedValue(claimed);
      settleContentSchedule.mockResolvedValue(false);
      const { c, dispatch } = harness();

      await expect(
        executeContentSchedule(c, { generation: 1, scheduleId: 55 }),
      ).rejects.toThrow(/no longer pending/);

      expect(dispatch).not.toHaveBeenCalled();
    });
  });

  it("runs as the system, never as a made-up user", async () => {
    claimContentSchedule.mockResolvedValue(claimed);
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
      claimContentSchedule.mockResolvedValue(claimed);
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
      claimContentSchedule.mockResolvedValue(claimed);
      const { c, dispatch } = harness();

      await executeContentSchedule(c, { generation: 1, scheduleId: 55 });

      expect(dispatchedPayload(dispatch).payload.wasPublic).toBe(false);
    });

    it("says the record was public before an unpublish", async () => {
      claimContentSchedule.mockResolvedValue({
        ...claimed,
        action: "unpublish",
      });
      const { c, dispatch } = harness();

      await executeContentSchedule(c, { generation: 1, scheduleId: 55 });

      expect(dispatchedPayload(dispatch).payload.wasPublic).toBe(true);
    });

    it("is JSON, so the queue can store and replay it", async () => {
      claimContentSchedule.mockResolvedValue(claimed);
      const { c, dispatch } = harness();

      await executeContentSchedule(c, { generation: 1, scheduleId: 55 });

      const { row: stored } = dispatchedPayload(dispatch).payload as {
        row: Record<string, unknown>;
      };
      expect(stored.publishedAt).toBe("2026-08-05T12:00:00.000Z");
      expect(stored.title).toBe("Hello world");
    });

    it("is stamped with core, so the worker can find the handler", async () => {
      claimContentSchedule.mockResolvedValue(claimed);
      const { c, dispatch } = harness();

      await executeContentSchedule(c, { generation: 1, scheduleId: 55 });

      expect(dispatchedPayload(dispatch).pluginId).toBe("@vitnode/core");
    });
  });

  describe("no-ops", () => {
    it("does nothing when the row is cancelled, superseded or not yet due", async () => {
      // All four guards collapse to the same answer from `claim`, so this is
      // one test rather than four identical ones.
      claimContentSchedule.mockResolvedValue(null);
      const { c, dispatch, publish } = harness();

      const result = await executeContentSchedule(c, {
        generation: 1,
        scheduleId: 55,
      });

      expect(result.status).toBe("skipped");
      expect(publish).not.toHaveBeenCalled();
      // The load-bearing part: a superseded task must not touch search or the
      // cache, or a cancelled plan would still expire a live page.
      expect(dispatch).not.toHaveBeenCalled();
      expect(settleContentSchedule).not.toHaveBeenCalled();
    });

    it("does nothing more when the record is already published", async () => {
      claimContentSchedule.mockResolvedValue(claimed);
      const { c, dispatch } = harness({
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
      expect(settleContentSchedule).toHaveBeenCalledWith(
        expect.anything(),
        55,
        {
          expectedStatus: "pending",
          lastError: null,
          status: "completed",
        },
      );
    });

    it("does nothing when the record was deleted first", async () => {
      claimContentSchedule.mockResolvedValue(claimed);
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
    claimContentSchedule.mockResolvedValue(claimed);
    const { c, dispatch } = harness({ registered: false });

    const result = await executeContentSchedule(c, {
      generation: 1,
      scheduleId: 55,
    });

    expect(result.status).toBe("unregistered");
    expect(settleContentSchedule).toHaveBeenCalledWith(
      expect.anything(),
      55,
      expect.objectContaining({
        expectedStatus: "pending",
        status: "cancelled",
      }),
    );
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("records the error and rethrows a real failure", async () => {
    // This one *is* worth retrying, and the queue's backoff is the policy.
    claimContentSchedule.mockResolvedValue(claimed);
    const { c } = harness({
      editorial: {
        publish: vi.fn().mockRejectedValue(new Error("deadlock detected")),
      },
    });

    await expect(
      executeContentSchedule(c, { generation: 1, scheduleId: 55 }),
    ).rejects.toThrow("deadlock detected");

    expect(settleContentSchedule).toHaveBeenCalledWith(expect.anything(), 55, {
      expectedStatus: "pending",
      lastError: "deadlock detected",
    });
    // Left pending, so the AdminCP shows it as overdue rather than done.
    expect(settleContentSchedule).not.toHaveBeenCalledWith(
      expect.anything(),
      55,
      expect.objectContaining({ status: "completed" }),
    );
  });

  it("passes the generation straight through to the claim", async () => {
    claimContentSchedule.mockResolvedValue(null);
    const { c } = harness();

    await executeContentSchedule(c, { generation: 4, scheduleId: 55 });

    expect(claimContentSchedule).toHaveBeenCalledWith(expect.anything(), {
      generation: 4,
      scheduleId: 55,
    });
  });
});
