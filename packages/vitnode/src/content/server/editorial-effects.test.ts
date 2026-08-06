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
}: { contextPlugin?: string; emit?: ReturnType<typeof vi.fn> } = {}) => {
  const store: Record<string, unknown> = {
    events: { emit },
    plugin: { id: contextPlugin },
  };

  return {
    c: { get: (key: string) => store[key] } as unknown as Context,
    emit,
  };
};

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
});
