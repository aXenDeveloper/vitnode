// @vitest-environment node
import type { Context } from "hono";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { testEditorialPostContentType } from "@/tests/content-fixtures";

const claimContentSchedule = vi.fn();
const settleContentSchedule = vi.fn();
const contentEditorialEffects = vi.fn();
const dispatchContentRevalidation = vi.fn();

vi.mock("@/content/server/schedules-model", () => ({
  claimContentSchedule: (...args: unknown[]) => claimContentSchedule(...args),
  settleContentSchedule: (...args: unknown[]) => settleContentSchedule(...args),
}));
vi.mock("@/content/server/editorial-effects", () => ({
  contentEditorialEffects: (...args: unknown[]) =>
    contentEditorialEffects(...args),
}));
vi.mock("@/content/server/revalidate-bridge", () => ({
  dispatchContentRevalidation: (...args: unknown[]) =>
    dispatchContentRevalidation(...args),
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
  id: 7,
  publishedAt: new Date("2026-08-05T12:00:00.000Z"),
  slug: "hello-world",
  status: "published",
  title: "Hello world",
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
  const findById = vi.fn().mockResolvedValue({
    ...row,
    publishedAt: null,
    status: "draft",
  });

  const model = {
    definition: testEditorialPostContentType,
    editorialService: () => ({ publish, unpublish, ...editorial }),
    service: () => ({ findById }),
  };

  const db = {
    transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      await fn({ tx: true }),
  };

  const c = {
    get: (key: string) =>
      key === "db"
        ? db
        : key === "core"
          ? {
              contentModels: registered ? [{ model, pluginId: PLUGIN_ID }] : [],
            }
          : undefined,
  } as unknown as Context;

  return { c, findById, publish, unpublish };
};

beforeEach(() => {
  vi.clearAllMocks();
  contentEditorialEffects.mockResolvedValue({ search: null });
  dispatchContentRevalidation.mockResolvedValue({
    attempted: 1,
    delivered: 1,
  });
});

describe("executeContentSchedule", () => {
  it("publishes, settles the schedule, and tells everyone once", async () => {
    claimContentSchedule.mockResolvedValue(claimed);
    const { c, publish } = harness();

    const result = await executeContentSchedule(c, {
      generation: 1,
      scheduleId: 55,
    });

    expect(result.status).toBe("executed");
    expect(publish).toHaveBeenCalledTimes(1);
    expect(contentEditorialEffects).toHaveBeenCalledTimes(1);
    expect(dispatchContentRevalidation).toHaveBeenCalledTimes(1);
  });

  it("runs as the system, never as a made-up user", async () => {
    claimContentSchedule.mockResolvedValue(claimed);
    const { c, publish } = harness();

    await executeContentSchedule(c, { generation: 1, scheduleId: 55 });

    expect(publish.mock.calls[0][1]).toMatchObject({
      actor: { type: "system", userId: null },
    });
  });

  it("names the person who booked it in the event", async () => {
    // The actor is genuinely the system, so "on whose instruction" has to come
    // from somewhere else - and it is the whole point of the audit trail.
    claimContentSchedule.mockResolvedValue(claimed);
    const { c } = harness();

    await executeContentSchedule(c, { generation: 1, scheduleId: 55 });

    expect(contentEditorialEffects.mock.calls[0][3]).toEqual({
      pluginId: PLUGIN_ID,
      scheduledBy: 3,
    });
  });

  it("expires both the old and the new slug", async () => {
    claimContentSchedule.mockResolvedValue(claimed);
    const { c, findById } = harness();
    findById.mockResolvedValue({ ...row, slug: "old-slug", status: "draft" });

    await executeContentSchedule(c, { generation: 1, scheduleId: 55 });

    expect(dispatchContentRevalidation.mock.calls[0][1]).toMatchObject({
      isPublic: true,
      mode: "immediate",
      slugs: ["old-slug", "hello-world"],
      wasPublic: false,
    });
  });

  describe("no-ops", () => {
    it("does nothing when the row is cancelled, superseded or not yet due", async () => {
      // All four guards collapse to the same answer from `claim`, so this is
      // one test rather than four identical ones.
      claimContentSchedule.mockResolvedValue(null);
      const { c, publish } = harness();

      const result = await executeContentSchedule(c, {
        generation: 1,
        scheduleId: 55,
      });

      expect(result.status).toBe("skipped");
      expect(publish).not.toHaveBeenCalled();
      // The load-bearing part: a superseded task must not touch search or the
      // cache, or a cancelled plan would still expire a live page.
      expect(contentEditorialEffects).not.toHaveBeenCalled();
      expect(dispatchContentRevalidation).not.toHaveBeenCalled();
    });

    it("does nothing more when the record is already published", async () => {
      claimContentSchedule.mockResolvedValue(claimed);
      const { c } = harness({
        editorial: {
          publish: vi.fn().mockResolvedValue({ ...outcome, changed: false }),
        },
      });

      const result = await executeContentSchedule(c, {
        generation: 1,
        scheduleId: 55,
      });

      expect(result.status).toBe("skipped");
      expect(contentEditorialEffects).not.toHaveBeenCalled();
      expect(dispatchContentRevalidation).not.toHaveBeenCalled();
      // Still settled, or it would be retried forever for a record that is
      // already in the state the schedule wanted.
      expect(settleContentSchedule).toHaveBeenCalledWith(
        expect.anything(),
        55,
        { lastError: null, status: "completed" },
      );
    });

    it("does nothing when the record was deleted first", async () => {
      claimContentSchedule.mockResolvedValue(claimed);
      const { c } = harness({
        editorial: { publish: vi.fn().mockResolvedValue(null) },
      });

      const result = await executeContentSchedule(c, {
        generation: 1,
        scheduleId: 55,
      });

      expect(result.status).toBe("skipped");
      expect(contentEditorialEffects).not.toHaveBeenCalled();
    });
  });

  it("cancels rather than retrying when the content type is gone", async () => {
    // A plugin removed, or `editorial` turned off. An error every ten minutes
    // forever is not a useful way to report a config change.
    claimContentSchedule.mockResolvedValue(claimed);
    const { c } = harness({ registered: false });

    const result = await executeContentSchedule(c, {
      generation: 1,
      scheduleId: 55,
    });

    expect(result.status).toBe("unregistered");
    expect(settleContentSchedule).toHaveBeenCalledWith(
      expect.anything(),
      55,
      expect.objectContaining({ status: "cancelled" }),
    );
    expect(dispatchContentRevalidation).not.toHaveBeenCalled();
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
