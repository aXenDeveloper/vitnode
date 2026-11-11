import type { Context } from "hono";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocalEventsAdapter } from "@/api/adapters/events/local";
import { buildEventListener } from "@/api/lib/events";
import { parseJsonWire } from "@/api/lib/json-wire";
import { buildModule } from "@/api/lib/module";
import { buildApiPlugin } from "@/api/lib/plugin";
import { EventsModel } from "@/api/models/events";
import { defineContentType } from "@/content/define";
import { field } from "@/content/fields";
import {
  configurePageCacheStore,
  createMemoryPageCacheStore,
  resetPageCacheStore,
} from "@/page-cache/store.server";
import { testManifest } from "@/tests/manifest";

import { contentEvent, contentEventDefinitionOf } from "./event-definitions";
import { emitContentEvent } from "./server/emit";

const serialType = defineContentType({
  id: "eventstest.serial",
  tableName: "events_test_serial",
  fields: {
    title: field.text({ required: true, maxLength: 100 }),
    body: field.textarea({ nullable: true }),
  },
  publication: true,
});

const uuidType = defineContentType({
  id: "eventstest.uuid",
  tableName: "events_test_uuid",
  idStrategy: "uuid",
  fields: { title: field.text({ required: true, maxLength: 100 }) },
});

const ownedType = defineContentType({
  id: "eventstest.owned",
  tableName: "events_test_owned",
  fields: { title: field.text({ required: true, maxLength: 100 }) },
});

const parse = async (event: { payload: unknown }, payload: unknown) =>
  await parseJsonWire(
    (event as { payload: Parameters<typeof parseJsonWire>[0] }).payload,
    payload,
    "payload",
  );

describe("contentEvent", () => {
  it("returns one stable definition per content type and action", () => {
    const created = contentEvent(serialType, "created");

    expect(contentEvent(serialType, "created")).toBe(created);
    expect(contentEventDefinitionOf(serialType, "created")).toBe(created);
    expect(contentEvent(serialType, "deleted")).not.toBe(created);
    expect(created.name).toBe("content.eventstest.serial.created");
  });

  it("is owned by the plugin that registers the content type", () => {
    const created = contentEvent(ownedType, "created");
    expect(created.pluginId).toBe("@vitnode/core");

    const plugin = buildApiPlugin({
      manifest: testManifest("@vitnode/events-test"),
      modules: [
        buildModule({
          pluginId: "@vitnode/events-test",
          name: "content",
          routes: [],
          contentTypes: [ownedType],
        }),
      ],
    });

    expect(created.pluginId).toBe("@vitnode/events-test");
    expect(plugin.eventDefinitions).toEqual(
      expect.arrayContaining([
        created,
        contentEvent(ownedType, "updated"),
        contentEvent(ownedType, "deleted"),
      ]),
    );
    expect(plugin.eventDefinitions?.map(event => event.name)).not.toContain(
      "content.eventstest.owned.published",
    );
  });

  it.each([
    [serialType, 7, true],
    [serialType, "7", false],
    [uuidType, "0b9b2c4e-7d1f-4f6a-9d39-3c3e1f6f8a10", true],
    [uuidType, 7, false],
  ] as const)(
    "types contentId by the id strategy (%#)",
    async (type, contentId, ok) => {
      const parsed = await parse(contentEvent(type, "deleted"), { contentId });

      expect(parsed.success).toBe(ok);
    },
  );

  it.each([
    [["title"], true],
    [["body", "title"], true],
    [["title.en"], true],
    [[], true],
    [["slug"], false],
    [["titles"], false],
  ])(
    "checks changedFields %j against the type's own fields",
    async (changedFields, ok) => {
      const parsed = await parse(contentEvent(serialType, "updated"), {
        changedFields,
        contentId: 1,
      });

      expect(parsed.success).toBe(ok);
    },
  );

  it("passes undeclared extras through", async () => {
    const parsed = await parse(contentEvent(serialType, "deleted"), {
      contentId: 1,
      version: 3,
    });

    expect(parsed).toMatchObject({
      data: { contentId: 1, version: 3 },
      success: true,
    });
  });
});

describe("emitContentEvent", () => {
  beforeEach(() => {
    configurePageCacheStore(createMemoryPageCacheStore(), { maxLifetime: 60 });
  });

  afterEach(() => {
    resetPageCacheStore();
  });

  const contextWith = (handler: (payload: unknown) => void) => {
    const values: Record<string, unknown> = {
      core: {
        events: {
          adapter: LocalEventsAdapter(),
          listeners: [
            {
              ...buildEventListener({
                event: contentEvent(serialType, "published"),
                name: "announce",
                handler: (_c, payload) => {
                  handler(payload);
                },
              }),
              module: "content",
              pluginId: "@vitnode/listener",
            },
          ],
        },
      },
      log: { error: vi.fn().mockResolvedValue(undefined) },
    };
    const c = { get: (key: string) => values[key] } as unknown as Context;
    values.events = new EventsModel(c);

    return c;
  };

  it("sends a Date as an ISO string and hands listeners a Date", async () => {
    const handler = vi.fn();
    const publishedAt = new Date("2026-11-11T10:00:00.000Z");

    const result = await emitContentEvent(
      contextWith(handler),
      serialType,
      "published",
      { contentId: 3, publishedAt },
    );

    expect(result.failures).toEqual([]);
    expect(handler).toHaveBeenCalledWith({ contentId: 3, publishedAt });
  });

  it("reports a payload that does not match the content type instead of throwing after the commit", async () => {
    const handler = vi.fn();

    const result = await emitContentEvent(
      contextWith(handler),
      serialType,
      "published",
      { contentId: "3" as unknown as number, publishedAt: new Date() },
    );

    expect(result.delivered).toBe(0);
    expect(result.failures).toEqual([
      expect.objectContaining({
        listener: contentEvent(serialType, "published").name,
        module: "validation",
      }),
    ]);
    expect(result.failures[0]?.error).not.toContain('"3"');
    expect(handler).not.toHaveBeenCalled();
  });
});
