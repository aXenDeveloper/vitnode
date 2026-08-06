// @vitest-environment node
import type { Context } from "hono";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { testEditorialPostContentType } from "@/tests/content-fixtures";

import type { ContentScheduleEffectsPayload } from "./schedule-effects";

const contentEditorialEffects = vi.fn();
const dispatchContentRevalidation = vi.fn();
const recordContentScheduleEffectsError = vi.fn();

vi.mock("./editorial-effects", () => ({
  contentEditorialEffects: (...args: unknown[]) =>
    contentEditorialEffects(...args),
}));
vi.mock("./revalidate-bridge", () => ({
  dispatchContentRevalidation: (...args: unknown[]) =>
    dispatchContentRevalidation(...args),
}));
vi.mock("./schedules-model", () => ({
  recordContentScheduleEffectsError: (...args: unknown[]) =>
    recordContentScheduleEffectsError(...args),
}));

const { contentScheduleEffectsPayloadSchema, runContentScheduleEffects } =
  await import("./schedule-effects");

const PLUGIN_ID = "@vitnode/example";

const payload = (
  overrides: Partial<ContentScheduleEffectsPayload> = {},
): ContentScheduleEffectsPayload => ({
  changedFields: [],
  contentTypeId: testEditorialPostContentType.id,
  itemId: 7,
  operation: "publish",
  pluginId: PLUGIN_ID,
  previousSlug: "hello-world",
  revisionId: 90,
  row: {
    createdAt: "2026-08-01T09:00:00.000Z",
    id: 7,
    publishedAt: "2026-08-05T12:00:00.000Z",
    slug: "hello-world",
    status: "published",
    title: "Hello world",
    updatedAt: "2026-08-05T12:00:00.000Z",
    version: 4,
  },
  scheduleId: 55,
  scheduledBy: 3,
  version: 4,
  wasPublic: false,
  ...overrides,
});

const harness = ({ registered = true }: { registered?: boolean } = {}) => {
  const c = {
    get: (key: string) =>
      key === "core"
        ? {
            contentModels: registered
              ? [
                  {
                    model: { definition: testEditorialPostContentType },
                    pluginId: PLUGIN_ID,
                  },
                ]
              : [],
          }
        : key === "db"
          ? { db: true }
          : undefined,
  } as unknown as Context;

  return { c };
};

/** What `EventsModel.emit` reports when every listener ran. */
const eventDelivered = {
  delivered: 2,
  eventId: "event-1",
  failures: [],
  status: "delivered",
};

const eventFailed = {
  delivered: 0,
  eventId: "event-1",
  failures: [
    {
      error: "Service unavailable",
      listener: "send-notification",
      module: "notifications",
      pluginId: PLUGIN_ID,
    },
  ],
  status: "delivered",
};

beforeEach(() => {
  vi.clearAllMocks();
  contentEditorialEffects.mockResolvedValue({
    event: eventDelivered,
    search: null,
  });
  dispatchContentRevalidation.mockResolvedValue({ attempted: 1, delivered: 1 });
  recordContentScheduleEffectsError.mockResolvedValue(undefined);
});

describe("runContentScheduleEffects", () => {
  it("emits, indexes and expires the cache exactly once", async () => {
    const { c } = harness();

    const outcome = await runContentScheduleEffects(c, payload());

    expect(outcome.status).toBe("delivered");
    expect(contentEditorialEffects).toHaveBeenCalledTimes(1);
    expect(dispatchContentRevalidation).toHaveBeenCalledTimes(1);
  });

  it("names the person who booked it, not the system that ran it", async () => {
    const { c } = harness();

    await runContentScheduleEffects(c, payload());

    expect(contentEditorialEffects.mock.calls[0][3]).toEqual({
      pluginId: PLUGIN_ID,
      scheduledBy: 3,
      scheduleId: 55,
    });
  });

  it("credits the content type's plugin, not the core queue handler", async () => {
    // Core owns `content-schedule-effects`, so `c.get("plugin")` says
    // `@vitnode/core` while this runs. The event still belongs to whoever owns
    // the content type, and the owner has to be passed explicitly to say so.
    const { c } = harness();

    await runContentScheduleEffects(c, payload());

    expect(contentEditorialEffects.mock.calls[0][3]).toMatchObject({
      pluginId: PLUGIN_ID,
    });
  });

  it("carries the schedule id, so a listener can be idempotent about retries", async () => {
    const { c } = harness();

    await runContentScheduleEffects(c, payload());

    expect(contentEditorialEffects.mock.calls[0][3]).toMatchObject({
      scheduleId: 55,
    });
  });

  it("never republishes - it only announces", async () => {
    // The reason this is a separate task at all. Nothing here calls the
    // editorial service, so a retry cannot move the record again.
    const { c } = harness();

    await runContentScheduleEffects(c, payload());

    const outcome = contentEditorialEffects.mock.calls[0][2] as {
      changed: boolean;
      operation: string;
    };
    expect(outcome).toMatchObject({ changed: true, operation: "publish" });
  });

  it("turns the payload's ISO strings back into dates", async () => {
    // `published` carries `publishedAt: Date`, and a listener must not be able
    // to tell a scheduled publish from a clicked one.
    const { c } = harness();

    await runContentScheduleEffects(c, payload());

    const { row } = contentEditorialEffects.mock.calls[0][2] as {
      row: Record<string, unknown>;
    };
    expect(row.publishedAt).toBeInstanceOf(Date);
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it("expires the old slug and the new one, without repeating either", async () => {
    const { c } = harness();

    await runContentScheduleEffects(c, payload());

    expect(dispatchContentRevalidation.mock.calls[0][1]).toMatchObject({
      isPublic: true,
      mode: "immediate",
      slugs: ["hello-world"],
      wasPublic: false,
    });
  });

  it("expires both when a transition moved the URL", async () => {
    const { c } = harness();

    await runContentScheduleEffects(c, payload({ previousSlug: "old-slug" }));

    expect(dispatchContentRevalidation.mock.calls[0][1]).toMatchObject({
      slugs: ["old-slug", "hello-world"],
    });
  });

  describe("retrying", () => {
    it("throws when no web origin accepted the invalidation", async () => {
      // The failure this task exists for: a scheduled unpublish whose cache
      // expiry did not land must be retried, and retrying the *publish* would
      // skip the expiry entirely.
      const { c } = harness();
      dispatchContentRevalidation.mockResolvedValue({
        attempted: 1,
        delivered: 0,
      });

      await expect(runContentScheduleEffects(c, payload())).rejects.toThrow(
        /cache/,
      );
    });

    it("throws when the search engine refused the document", async () => {
      const { c } = harness();
      contentEditorialEffects.mockResolvedValue({
        event: eventDelivered,
        search: { action: "upsert", documentId: "x", error: new Error("down") },
      });

      await expect(runContentScheduleEffects(c, payload())).rejects.toThrow(
        /search/,
      );
    });

    it("still expires the cache when search failed", async () => {
      // Two independent systems. One being down is not a reason to skip the
      // other, and both are retried together afterwards.
      const { c } = harness();
      contentEditorialEffects.mockResolvedValue({
        event: eventDelivered,
        search: { action: "upsert", documentId: "x", error: new Error("down") },
      });

      await expect(runContentScheduleEffects(c, payload())).rejects.toThrow();

      expect(dispatchContentRevalidation).toHaveBeenCalledTimes(1);
    });

    it("does not treat 'nothing to tell' as an outage", async () => {
      // No tags to expire, or no web origin configured. Both are decisions.
      const { c } = harness();
      dispatchContentRevalidation.mockResolvedValue({
        attempted: 0,
        delivered: 0,
      });

      await expect(
        runContentScheduleEffects(c, payload()),
      ).resolves.toMatchObject({ status: "delivered" });
    });
  });

  describe("multi-origin cache delivery", () => {
    it("retries when one of two origins refused it", async () => {
      // The dangerous case, and the one that used to pass. Two web apps behind
      // one API: if only one expired its cache after a scheduled unpublish, the
      // other keeps serving the withdrawn page - and calling that "delivered"
      // means it never gets another chance to.
      const { c } = harness();
      dispatchContentRevalidation.mockResolvedValue({
        attempted: 2,
        delivered: 1,
      });

      await expect(runContentScheduleEffects(c, payload())).rejects.toThrow(
        /1\/2 web origins/,
      );
    });

    it("records which origins are still stale", async () => {
      const { c } = harness();
      dispatchContentRevalidation.mockResolvedValue({
        attempted: 3,
        delivered: 2,
      });

      await expect(runContentScheduleEffects(c, payload())).rejects.toThrow();

      expect(recordContentScheduleEffectsError).toHaveBeenCalledWith(
        expect.anything(),
        55,
        expect.stringContaining("cache: 2/3 web origins"),
      );
    });

    it("succeeds when every origin accepted it", async () => {
      const { c } = harness();
      dispatchContentRevalidation.mockResolvedValue({
        attempted: 2,
        delivered: 2,
      });

      await expect(
        runContentScheduleEffects(c, payload()),
      ).resolves.toMatchObject({ status: "delivered" });
    });
  });

  describe("event delivery", () => {
    it("retries when a listener failed", async () => {
      // `EventsModel.emit` reports rather than throws, so a failure is only
      // visible in the result. Discarding it made a dead notification listener
      // indistinguishable from a delivered one.
      const { c } = harness();
      contentEditorialEffects.mockResolvedValue({
        event: eventFailed,
        search: null,
      });

      await expect(runContentScheduleEffects(c, payload())).rejects.toThrow(
        /event/,
      );
    });

    it("keeps enough detail to find the listener that broke", async () => {
      const { c } = harness();
      contentEditorialEffects.mockResolvedValue({
        event: eventFailed,
        search: null,
      });

      await expect(runContentScheduleEffects(c, payload())).rejects.toThrow();

      const [, , message] = recordContentScheduleEffectsError.mock.calls[0] as [
        unknown,
        number,
        string,
      ];
      expect(message).toContain("notifications");
      expect(message).toContain("send-notification");
      expect(message).toContain("Service unavailable");
    });

    it("still expires the cache when the event failed", async () => {
      const { c } = harness();
      contentEditorialEffects.mockResolvedValue({
        event: eventFailed,
        search: null,
      });

      await expect(runContentScheduleEffects(c, payload())).rejects.toThrow();

      expect(dispatchContentRevalidation).toHaveBeenCalledTimes(1);
    });

    it("treats an event with no listeners as delivered", async () => {
      // Nobody subscribed is not a failure. `delivered: 0` with no failures is
      // the ordinary shape for an event nothing listens to.
      const { c } = harness();
      contentEditorialEffects.mockResolvedValue({
        event: { ...eventDelivered, delivered: 0 },
        search: null,
      });

      await expect(
        runContentScheduleEffects(c, payload()),
      ).resolves.toMatchObject({ status: "delivered" });
    });

    it("combines every outstanding failure into one message", async () => {
      const { c } = harness();
      contentEditorialEffects.mockResolvedValue({
        event: eventFailed,
        search: {
          action: "upsert",
          documentId: "x",
          error: new Error("Elasticsearch unavailable"),
        },
      });
      dispatchContentRevalidation.mockResolvedValue({
        attempted: 2,
        delivered: 1,
      });

      await expect(runContentScheduleEffects(c, payload())).rejects.toThrow();

      const [, , message] = recordContentScheduleEffectsError.mock.calls[0] as [
        unknown,
        number,
        string,
      ];
      expect(message).toContain("event:");
      expect(message).toContain("search: Elasticsearch unavailable");
      expect(message).toContain("cache: 1/2 web origins");
    });

    it("clears everything once one run gets all three through", async () => {
      const { c } = harness();

      await expect(
        runContentScheduleEffects(c, payload()),
      ).resolves.toMatchObject({ status: "delivered" });

      expect(recordContentScheduleEffectsError).toHaveBeenCalledWith(
        expect.anything(),
        55,
        null,
      );
    });
  });

  describe("effect failure is reported separately", () => {
    it("records why, without touching the schedule's status", async () => {
      const { c } = harness();
      dispatchContentRevalidation.mockResolvedValue({
        attempted: 2,
        delivered: 0,
      });

      await expect(runContentScheduleEffects(c, payload())).rejects.toThrow();

      expect(recordContentScheduleEffectsError).toHaveBeenCalledWith(
        expect.anything(),
        55,
        expect.stringContaining("cache"),
      );
    });

    it("clears it on the run that finally gets through", async () => {
      const { c } = harness();

      await runContentScheduleEffects(c, payload());

      expect(recordContentScheduleEffectsError).toHaveBeenCalledWith(
        expect.anything(),
        55,
        null,
      );
    });
  });

  it("gives up quietly when the content type has been removed", async () => {
    // No definition means no event to build and no document to write. Retrying
    // would never succeed, and the record is already correctly published.
    const { c } = harness({ registered: false });

    const outcome = await runContentScheduleEffects(c, payload());

    expect(outcome.status).toBe("unregistered");
    expect(contentEditorialEffects).not.toHaveBeenCalled();
    expect(dispatchContentRevalidation).not.toHaveBeenCalled();
  });
});

describe("contentScheduleEffectsPayloadSchema", () => {
  it("accepts what the executor writes", () => {
    expect(
      contentScheduleEffectsPayloadSchema.safeParse(payload()).success,
    ).toBe(true);
  });

  it("refuses a payload missing the record it is about", () => {
    const { itemId, ...rest } = payload();
    void itemId;

    expect(contentScheduleEffectsPayloadSchema.safeParse(rest).success).toBe(
      false,
    );
  });

  it("refuses an operation that is not a publication transition", () => {
    expect(
      contentScheduleEffectsPayloadSchema.safeParse(
        payload({ operation: "update" as never }),
      ).success,
    ).toBe(false);
  });
});
