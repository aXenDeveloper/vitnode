// @vitest-environment node
import type { SQL } from "drizzle-orm";
import type { Context } from "hono";

import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { core_content_schedules } from "@/database/content";
import { testSearchablePostContentType } from "@/tests/content-fixtures";

import type { ContentScheduleEffectsPayload } from "./schedule-effects";

import { CONTENT_REVALIDATE_PATH } from "./revalidate-bridge";
import {
  contentScheduleEffectsPayloadSchema,
  runContentScheduleEffects,
} from "./schedule-effects";

const PLUGIN_ID = "@vitnode/example";

const definition = testSearchablePostContentType;

const WEB = "https://web.test";
const MIRROR = "https://mirror.test";
const ARCHIVE = "https://archive.test";

const dialect = new PgDialect();

const compile = (condition: SQL | undefined) => {
  if (!condition) throw new Error("Expected a condition.");

  return dialect.sqlToQuery(condition);
};

const payload = (
  overrides: Partial<ContentScheduleEffectsPayload> = {},
): ContentScheduleEffectsPayload => ({
  changedFields: [],
  contentTypeId: definition.id,
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

interface EffectsErrorWrite {
  condition: SQL | undefined;
  patch: Record<string, unknown>;
  table: string;
}

const harness = ({
  event = eventDelivered,
  origins = { [WEB]: 200 },
  registered = true,
  searchError,
}: {
  event?: typeof eventDelivered | typeof eventFailed;
  origins?: Record<string, number>;
  registered?: boolean;
  searchError?: Error;
} = {}) => {
  const emit = vi.fn().mockResolvedValue(event);
  const search = {
    delete: vi.fn().mockResolvedValue(undefined),
    index: searchError
      ? vi.fn().mockRejectedValue(searchError)
      : vi.fn().mockResolvedValue(undefined),
  };
  const effectsErrors: EffectsErrorWrite[] = [];

  const db = {
    update: (table: typeof core_content_schedules) => ({
      set: (patch: Record<string, unknown>) => ({
        where: async (condition: SQL | undefined) => {
          effectsErrors.push({ condition, patch, table: getTableName(table) });
          await Promise.resolve();
        },
      }),
    }),
  };

  const fetch = vi.fn(
    async (url: string, _init: RequestInit) =>
      await Promise.resolve(
        new Response(null, { status: origins[new URL(url).origin] ?? 404 }),
      ),
  );
  vi.stubGlobal("fetch", fetch);

  const store: Record<string, unknown> = {
    core: {
      contentModels: registered
        ? [{ model: { definition }, pluginId: PLUGIN_ID }]
        : [],
      contentRevalidateOrigins: Object.keys(origins),
      cronSecret: "test-secret",
    },
    db,
    events: { emit },
    log: { error: vi.fn().mockResolvedValue(undefined) },
    plugin: { id: "@vitnode/core" },
    search,
  };

  const c = { get: (key: string) => store[key] } as unknown as Context;

  return { c, effectsErrors, emit, fetch, search };
};

const revalidationBody = (fetch: ReturnType<typeof harness>["fetch"]) =>
  JSON.parse(fetch.mock.calls[0][1].body as string) as Record<string, unknown>;

const recordedError = (effectsErrors: EffectsErrorWrite[]) =>
  String(effectsErrors[0].patch.effectsError);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runContentScheduleEffects", () => {
  it("emits, indexes and expires the cache exactly once", async () => {
    const { c, emit, fetch, search } = harness();

    const outcome = await runContentScheduleEffects(c, payload());

    expect(outcome.status).toBe("delivered");
    expect(emit).toHaveBeenCalledTimes(1);
    expect(search.index).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe(`${WEB}${CONTENT_REVALIDATE_PATH}`);
  });

  it("names the person who booked it, not the system that ran it", async () => {
    const { c, emit } = harness();

    await runContentScheduleEffects(c, payload());

    expect(emit.mock.calls[0][1]).toMatchObject({
      scheduledBy: 3,
      scheduleId: 55,
    });
    expect(emit.mock.calls[0][2]).toEqual({ pluginId: PLUGIN_ID });
  });

  it("credits the content type's plugin, not the core queue handler", async () => {
    // Core owns `content-schedule-effects`, so `c.get("plugin")` says
    // `@vitnode/core` while this runs. The event still belongs to whoever owns
    // the content type, and the owner has to be passed explicitly to say so.
    const { c, emit, search } = harness();

    await runContentScheduleEffects(c, payload());

    expect(emit.mock.calls[0][2]).toEqual({ pluginId: PLUGIN_ID });
    expect(search.index.mock.calls[0][0]).toMatchObject({
      pluginId: PLUGIN_ID,
    });
  });

  it("carries the schedule id, so a listener can be idempotent about retries", async () => {
    const { c, emit } = harness();

    await runContentScheduleEffects(c, payload());

    expect(emit.mock.calls[0][1]).toMatchObject({ scheduleId: 55 });
  });

  it("never republishes - it only announces", async () => {
    // The reason this is a separate task at all. Nothing here calls the
    // editorial service, so a retry cannot move the record again.
    const { c, effectsErrors, emit } = harness();

    await runContentScheduleEffects(c, payload());

    expect(emit.mock.calls[0][0]).toBe(`content.${definition.id}.published`);
    expect(effectsErrors).toEqual([
      {
        condition: expect.anything(),
        patch: { effectsError: null },
        table: getTableName(core_content_schedules),
      },
    ]);
  });

  it("turns the payload's ISO strings back into dates", async () => {
    // `published` carries `publishedAt: Date`, and a listener must not be able
    // to tell a scheduled publish from a clicked one.
    const { c, emit } = harness();

    await runContentScheduleEffects(c, payload());

    const event = emit.mock.calls[0][1] as Record<string, unknown>;
    expect(event.publishedAt).toBeInstanceOf(Date);
    expect(event.publishedAt).toEqual(new Date("2026-08-05T12:00:00.000Z"));
  });

  it("expires the old slug and the new one, without repeating either", async () => {
    const { c, fetch } = harness();

    await runContentScheduleEffects(c, payload());

    expect(revalidationBody(fetch)).toMatchObject({
      isPublic: true,
      mode: "immediate",
      slugs: ["hello-world"],
      wasPublic: false,
    });
  });

  it("expires both when a transition moved the URL", async () => {
    const { c, fetch } = harness();

    await runContentScheduleEffects(c, payload({ previousSlug: "old-slug" }));

    expect(revalidationBody(fetch)).toMatchObject({
      slugs: ["old-slug", "hello-world"],
    });
  });

  describe("retrying", () => {
    it("throws when no web origin accepted the invalidation", async () => {
      // The failure this task exists for: a scheduled unpublish whose cache
      // expiry did not land must be retried, and retrying the *publish* would
      // skip the expiry entirely.
      const { c } = harness({ origins: { [WEB]: 403 } });

      await expect(runContentScheduleEffects(c, payload())).rejects.toThrow(
        /cache/,
      );
    });

    it("throws when the search engine refused the document", async () => {
      const { c } = harness({ searchError: new Error("down") });

      await expect(runContentScheduleEffects(c, payload())).rejects.toThrow(
        /search/,
      );
    });

    it("still expires the cache when search failed", async () => {
      // Two independent systems. One being down is not a reason to skip the
      // other, and both are retried together afterwards.
      const { c, fetch } = harness({ searchError: new Error("down") });

      await expect(runContentScheduleEffects(c, payload())).rejects.toThrow();

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("does not treat 'nothing to tell' as an outage", async () => {
      // No tags to expire, or no web origin configured. Both are decisions.
      const { c, fetch } = harness({ origins: {} });

      await expect(
        runContentScheduleEffects(c, payload()),
      ).resolves.toMatchObject({ status: "delivered" });
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("multi-origin cache delivery", () => {
    it("retries when one of two origins refused it", async () => {
      // The dangerous case, and the one that used to pass. Two web apps behind
      // one API: if only one expired its cache after a scheduled unpublish, the
      // other keeps serving the withdrawn page - and calling that "delivered"
      // means it never gets another chance to.
      const { c } = harness({ origins: { [MIRROR]: 403, [WEB]: 200 } });

      await expect(runContentScheduleEffects(c, payload())).rejects.toThrow(
        /1\/2 web origins/,
      );
    });

    it("records which origins are still stale", async () => {
      const { c, effectsErrors } = harness({
        origins: { [ARCHIVE]: 403, [MIRROR]: 200, [WEB]: 200 },
      });

      await expect(runContentScheduleEffects(c, payload())).rejects.toThrow();

      expect(recordedError(effectsErrors)).toContain("cache: 2/3 web origins");
      expect(compile(effectsErrors[0].condition).params).toEqual([55]);
    });

    it("succeeds when every origin accepted it", async () => {
      const { c, fetch } = harness({
        origins: { [MIRROR]: 200, [WEB]: 200 },
      });

      await expect(
        runContentScheduleEffects(c, payload()),
      ).resolves.toMatchObject({ status: "delivered" });
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("event delivery", () => {
    it("retries when a listener failed", async () => {
      // `EventsModel.emit` reports rather than throws, so a failure is only
      // visible in the result. Discarding it made a dead notification listener
      // indistinguishable from a delivered one.
      const { c } = harness({ event: eventFailed });

      await expect(runContentScheduleEffects(c, payload())).rejects.toThrow(
        /event/,
      );
    });

    it("keeps enough detail to find the listener that broke", async () => {
      const { c, effectsErrors } = harness({ event: eventFailed });

      await expect(runContentScheduleEffects(c, payload())).rejects.toThrow();

      const message = recordedError(effectsErrors);
      expect(message).toContain("notifications");
      expect(message).toContain("send-notification");
      expect(message).toContain("Service unavailable");
    });

    it("still expires the cache when the event failed", async () => {
      const { c, fetch } = harness({ event: eventFailed });

      await expect(runContentScheduleEffects(c, payload())).rejects.toThrow();

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("treats an event with no listeners as delivered", async () => {
      // Nobody subscribed is not a failure. `delivered: 0` with no failures is
      // the ordinary shape for an event nothing listens to.
      const { c } = harness({ event: { ...eventDelivered, delivered: 0 } });

      await expect(
        runContentScheduleEffects(c, payload()),
      ).resolves.toMatchObject({ status: "delivered" });
    });

    it("combines every outstanding failure into one message", async () => {
      const { c, effectsErrors } = harness({
        event: eventFailed,
        origins: { [MIRROR]: 403, [WEB]: 200 },
        searchError: new Error("Elasticsearch unavailable"),
      });

      await expect(runContentScheduleEffects(c, payload())).rejects.toThrow();

      const message = recordedError(effectsErrors);
      expect(message).toContain("event:");
      expect(message).toContain("search: Elasticsearch unavailable");
      expect(message).toContain("cache: 1/2 web origins");
    });

    it("clears everything once one run gets all three through", async () => {
      const { c, effectsErrors } = harness();

      await expect(
        runContentScheduleEffects(c, payload()),
      ).resolves.toMatchObject({ status: "delivered" });

      expect(effectsErrors).toHaveLength(1);
      expect(effectsErrors[0].patch).toEqual({ effectsError: null });
      expect(compile(effectsErrors[0].condition).params).toEqual([55]);
    });
  });

  describe("effect failure is reported separately", () => {
    it("records why, without touching the schedule's status", async () => {
      const { c, effectsErrors } = harness({
        origins: { [MIRROR]: 403, [WEB]: 403 },
      });

      await expect(runContentScheduleEffects(c, payload())).rejects.toThrow();

      expect(effectsErrors).toHaveLength(1);
      expect(effectsErrors[0].patch).toEqual({
        effectsError: expect.stringContaining("cache"),
      });
      expect(compile(effectsErrors[0].condition).params).toEqual([55]);
    });

    it("clears it on the run that finally gets through", async () => {
      const { c, effectsErrors } = harness();

      await runContentScheduleEffects(c, payload());

      expect(effectsErrors[0].patch).toEqual({ effectsError: null });
      expect(compile(effectsErrors[0].condition).params).toEqual([55]);
    });
  });

  it("gives up quietly when the content type has been removed", async () => {
    // No definition means no event to build and no document to write. Retrying
    // would never succeed, and the record is already correctly published.
    const { c, emit, fetch, search } = harness({ registered: false });

    const outcome = await runContentScheduleEffects(c, payload());

    expect(outcome.status).toBe("unregistered");
    expect(emit).not.toHaveBeenCalled();
    expect(search.index).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("contentScheduleEffectsPayloadSchema", () => {
  it("accepts what the executor writes", () => {
    expect(
      contentScheduleEffectsPayloadSchema.safeParse(payload()).success,
    ).toBe(true);
  });

  it("refuses a payload missing the record it is about", () => {
    const { itemId: _itemId, ...rest } = payload();

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
