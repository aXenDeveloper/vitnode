// @vitest-environment node
import type { Context } from "hono";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { testEditorialPostContentType } from "@/tests/content-fixtures";

import type { ContentEditorialOutcome } from "./editorial-service";

const syncContentSearch = vi.fn();

vi.mock("./search-sync", () => ({
  syncContentSearch: (...args: unknown[]) => syncContentSearch(...args),
}));

const { contentEditorialEffects } = await import("./editorial-effects");

const OWNER = "@vitnode/example";

const outcome = (
  overrides: Partial<ContentEditorialOutcome<never>> = {},
): ContentEditorialOutcome<never> =>
  ({
    changed: true,
    changedFields: [],
    operation: "publish",
    previousSlug: null,
    restoredFromRevisionId: null,
    revisionId: 90,
    row: {
      id: 7,
      publishedAt: new Date("2026-08-05T12:00:00.000Z"),
      slug: "hello-world",
      status: "published",
      title: "Hello world",
      version: 4,
    },
    version: 4,
    ...overrides,
  }) as unknown as ContentEditorialOutcome<never>;

const harness = ({
  contextPlugin = "@vitnode/core",
  emit = vi.fn().mockResolvedValue({
    delivered: 1,
    eventId: "event-1",
    failures: [],
    status: "delivered",
  }),
  log = vi.fn().mockResolvedValue(undefined),
}: {
  contextPlugin?: string;
  emit?: ReturnType<typeof vi.fn>;
  log?: ReturnType<typeof vi.fn>;
} = {}) => {
  const store: Record<string, unknown> = {
    events: { emit },
    // The effects layer writes post-commit failures here. Present on the
    // harness because a missing logger is itself a tested fallback, not the
    // shape a real request has.
    log: { error: log },
    plugin: { id: contextPlugin },
  };

  return {
    c: { get: (key: string) => store[key] } as unknown as Context,
    emit,
    log,
  };
};

/** An emit result with one dead listener on it. */
const withFailure = () =>
  vi.fn().mockResolvedValue({
    delivered: 0,
    eventId: "event-1",
    failures: [
      {
        error: "Service unavailable",
        listener: "send-notification",
        module: "notifications",
        pluginId: OWNER,
      },
    ],
    status: "delivered",
  });

beforeEach(() => {
  vi.clearAllMocks();
  syncContentSearch.mockResolvedValue({
    action: "upsert",
    documentId: "example.post:7",
  });
});

describe("contentEditorialEffects", () => {
  it("returns what the event transport and the index both reported", async () => {
    // Both, because `EventsModel.emit` does not throw: discarding its result
    // makes a dead listener look exactly like a delivered one.
    const { c } = harness();

    const result = await contentEditorialEffects(
      c,
      testEditorialPostContentType,
      outcome(),
      { pluginId: OWNER },
    );

    expect(result.event).toMatchObject({ delivered: 1, failures: [] });
    expect(result.search).toMatchObject({ action: "upsert" });
  });

  it("surfaces a listener failure rather than swallowing it", async () => {
    const { c } = harness({
      emit: vi.fn().mockResolvedValue({
        delivered: 0,
        eventId: "event-1",
        failures: [
          {
            error: "Service unavailable",
            listener: "send-notification",
            module: "notifications",
            pluginId: OWNER,
          },
        ],
        status: "delivered",
      }),
    });

    const result = await contentEditorialEffects(
      c,
      testEditorialPostContentType,
      outcome(),
      { pluginId: OWNER },
    );

    expect(result.event?.failures).toHaveLength(1);
  });

  it("still writes the search document when the event failed", async () => {
    // Two independent systems, and an interactive mutation has already
    // committed by the time either runs.
    const { c } = harness({
      emit: vi.fn().mockResolvedValue({
        delivered: 0,
        eventId: "event-1",
        failures: [
          {
            error: "down",
            listener: "l",
            module: "m",
            pluginId: OWNER,
          },
        ],
        status: "delivered",
      }),
    });

    await contentEditorialEffects(c, testEditorialPostContentType, outcome(), {
      pluginId: OWNER,
    });

    expect(syncContentSearch).toHaveBeenCalledTimes(1);
  });

  it("credits the content type's owner, not the plugin on the context", async () => {
    const { c, emit } = harness({ contextPlugin: "@vitnode/core" });

    await contentEditorialEffects(c, testEditorialPostContentType, outcome(), {
      pluginId: OWNER,
    });

    expect(emit.mock.calls[0][2]).toEqual({ pluginId: OWNER });
  });

  it("does no work at all for a no-op outcome", async () => {
    // A double-clicked publish button transitions nothing, so there is nothing
    // to announce and nothing to index.
    const { c, emit } = harness();

    const result = await contentEditorialEffects(
      c,
      testEditorialPostContentType,
      outcome({ changed: false }),
      { pluginId: OWNER },
    );

    expect(result).toEqual({ event: null, search: null });
    expect(emit).not.toHaveBeenCalled();
    expect(syncContentSearch).not.toHaveBeenCalled();
  });

  describe("the payload", () => {
    it("carries no scheduling keys for an interactive mutation", async () => {
      // Absent rather than null, so no existing listener sees a new field.
      const { c, emit } = harness();

      await contentEditorialEffects(
        c,
        testEditorialPostContentType,
        outcome(),
        { pluginId: OWNER },
      );

      const payload = emit.mock.calls[0][1] as Record<string, unknown>;
      expect(payload).not.toHaveProperty("scheduleId");
      expect(payload).not.toHaveProperty("scheduledBy");
    });

    it("carries the booking and its owner when a schedule fired it", async () => {
      const { c, emit } = harness();

      await contentEditorialEffects(
        c,
        testEditorialPostContentType,
        outcome(),
        { pluginId: OWNER, scheduledBy: 3, scheduleId: 55 },
      );

      expect(emit.mock.calls[0][1]).toMatchObject({
        contentId: 7,
        revisionId: 90,
        scheduledBy: 3,
        scheduleId: 55,
        version: 4,
      });
    });
  });

  describe("reporting a delivery failure", () => {
    it("logs the failed listener with the record it belongs to", async () => {
      const { c, log } = harness({ emit: withFailure() });

      await contentEditorialEffects(
        c,
        testEditorialPostContentType,
        outcome(),
        { pluginId: OWNER },
      );

      expect(log).toHaveBeenCalledTimes(1);
      const message = String(log.mock.calls[0][0]);
      expect(message).toContain("[content-effects]");
      expect(message).toContain(testEditorialPostContentType.id);
      expect(message).toContain('"itemId":7');
      expect(message).toContain("send-notification");
      expect(message).toContain("Service unavailable");
    });

    it("names the action, so a failed publish is not read as a failed edit", async () => {
      const { c, log } = harness({ emit: withFailure() });

      await contentEditorialEffects(
        c,
        testEditorialPostContentType,
        outcome({ operation: "unpublish" }),
        { pluginId: OWNER },
      );

      expect(String(log.mock.calls[0][0])).toContain('"action":"unpublished"');
    });

    it("logs nothing when every listener received it", async () => {
      // An expected success is not an error, and a log full of them is a log
      // nobody reads.
      const { c, log } = harness();

      await contentEditorialEffects(
        c,
        testEditorialPostContentType,
        outcome(),
        { pluginId: OWNER },
      );

      expect(log).not.toHaveBeenCalled();
    });

    it("does not fail the mutation when the logger itself is down", async () => {
      // The logger writes to the database, so it can fail for the same reason
      // the transport did - and the write has already committed either way.
      const { c } = harness({
        emit: withFailure(),
        log: vi.fn().mockRejectedValue(new Error("core_logs unreachable")),
      });
      const console_ = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      const result = await contentEditorialEffects(
        c,
        testEditorialPostContentType,
        outcome(),
        { pluginId: OWNER },
      );

      expect(result.event?.failures).toHaveLength(1);
      expect(console_).toHaveBeenCalled();
      console_.mockRestore();
    });

    it("still writes the search document after reporting the failure", async () => {
      const { c } = harness({ emit: withFailure() });

      await contentEditorialEffects(
        c,
        testEditorialPostContentType,
        outcome(),
        { pluginId: OWNER },
      );

      expect(syncContentSearch).toHaveBeenCalledTimes(1);
    });
  });
});
