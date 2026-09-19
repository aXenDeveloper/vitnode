// @vitest-environment node
import type { MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AnyEditablePageDefinition } from "@/content/editor/types";
import type { PageLayoutZones } from "@/database/page-layouts";

import { registerEditablePage } from "@/api/lib/editable-pages";
import { defineBlock } from "@/blocks/define";
import {
  createBlockRegistry,
  setDefaultBlockRegistry,
} from "@/blocks/registry";
import { defineEditablePage } from "@/content/editor/define";
import { field } from "@/content/fields";

import { buildPageLayoutRoutes } from "./page-layout-routes";

let granted = new Set<string>();
let grantedPlugin = "@vitnode/core";

vi.mock("@/api/lib/check-staff-permission", () => ({
  assertStaffPermission: async (
    _c: unknown,
    args: { permission: string; plugin: string },
  ) => {
    if (granted.has(args.permission) && args.plugin === grantedPlugin) return;

    const { HTTPException } = await import("hono/http-exception");
    throw new HTTPException(403, { message: "Forbidden" });
  },
}));

const Noop = () => null;

const heroBlock = defineBlock({
  component: Noop,
  fields: { title: field.text({ maxLength: 40, required: true }) },
  id: "hero",
  variants: [{ id: "wide" }],
});

const quoteBlock = defineBlock({
  component: Noop,
  fields: { text: field.text({ maxLength: 80, required: true }) },
  id: "quote",
});

const textBlock = defineBlock({
  component: Noop,
  fields: {
    body: field.text({ maxLength: 80, required: true }),
    width: field.enum({ defaultValue: "prose", values: ["prose", "wide"] }),
  },
  id: "text",
});

beforeAll(() => {
  setDefaultBlockRegistry(
    createBlockRegistry([
      {
        blocks: [heroBlock, quoteBlock, textBlock],
        namespace: "core",
        pluginId: "@vitnode/core",
      },
    ]),
  );
});

const PLUGIN_ID = "@vitnode/core";

const hero = (id: string, title: string, variant?: string) => ({
  data: { title },
  id,
  type: "core:hero",
  ...(variant === undefined ? {} : { variant }),
});

const quote = (id: string, text: string) => ({
  data: { text },
  id,
  type: "core:quote",
});

const text = (id: string, body: string, width?: string) => ({
  data: { body, ...(width === undefined ? {} : { width }) },
  id,
  type: "core:text",
});

const area = (id: string, children: unknown[]) => ({
  children,
  id,
  kind: "area",
  layout: { columns: 2 },
});

const settingsPage = defineEditablePage({
  id: "example:settings",
  permission: { module: "widgets", permission: "can_edit" },
  zones: {
    "before-profile": {
      allowed: ["core:hero", "core:quote"],
      default: [hero("shipped", "Shipped default")],
      max: 3,
    },
    intro: {
      allowed: ["core:text"],
      default: [text("intro-shipped", "Shipped intro")],
    },
    sidebar: { allowed: ["core:quote"], max: 20 },
    "after-profile": {
      allowed: ["core:quote"],
      default: [quote("after-shipped", "Shipped after")],
      min: 1,
    },
  },
});

const otherPage = defineEditablePage({
  id: "example:forum",
  permission: { module: "forum", permission: "can_edit" },
  zones: { header: { allowed: ["core:quote"] } },
});

const STORED_AT = new Date("2026-01-01T00:00:00Z");

interface EmittedEvent {
  name: string;
  payload: Record<string, unknown>;
}

interface StoredRow {
  pageId: string;
  updatedAt: Date;
  zones: PageLayoutZones;
}

const pageIdOf = (condition: unknown): string =>
  String(
    (condition as { queryChunks: { value?: unknown }[] }).queryChunks.find(
      chunk => typeof chunk.value === "string",
    )?.value,
  );

const harness = ({
  pages = [settingsPage, otherPage],
  readFails = false,
  rows = {},
}: {
  pages?: readonly AnyEditablePageDefinition[];
  readFails?: boolean;
  rows?: Record<string, PageLayoutZones>;
} = {}) => {
  const store = new Map<string, StoredRow>(
    Object.entries(rows).map(([pageId, zones]) => [
      pageId,
      { pageId, updatedAt: STORED_AT, zones },
    ]),
  );
  const events: EmittedEvent[] = [];
  const statements: string[] = [];
  const writes: string[] = [];

  const db = {
    execute: async () => {
      statements.push("lock");

      return await Promise.resolve([]);
    },
    transaction: async <TResult>(
      body: (tx: typeof db) => Promise<TResult>,
    ): Promise<TResult> => {
      statements.push("begin");

      return await body(db);
    },
    delete: () => ({
      where: async (condition: unknown) => {
        const pageId = pageIdOf(condition);
        statements.push("delete");
        writes.push(`delete ${pageId}`);
        store.delete(pageId);

        return await Promise.resolve([]);
      },
    }),
    insert: () => ({
      values: (values: StoredRow) => ({
        onConflictDoUpdate: () => ({
          returning: async () => {
            statements.push("upsert");
            writes.push(`upsert ${values.pageId}`);
            store.set(values.pageId, values);

            return await Promise.resolve([values]);
          },
        }),
      }),
    }),
    select: () => ({
      from: () => ({
        where: (condition: unknown) => ({
          limit: async () => {
            statements.push("select");
            if (readFails) throw new Error("connection terminated");
            const row = store.get(pageIdOf(condition));

            return await Promise.resolve(row === undefined ? [] : [row]);
          },
        }),
      }),
    }),
  };

  const app = new OpenAPIHono();
  const context: MiddlewareHandler = async (c, next) => {
    c.set("user", { id: 1, roleId: 1 } as never);
    c.set("core", {
      editablePages: pages.map(page => registerEditablePage(page, PLUGIN_ID)),
    } as never);
    c.set("events", {
      emit: async (name: string, payload: Record<string, unknown>) => {
        events.push({ name, payload });

        return await Promise.resolve({ failures: [], listeners: 0 });
      },
    } as never);
    c.set("db", db as never);
    await next();
  };
  app.use("*", context);

  const [read, write] = buildPageLayoutRoutes({ pluginId: PLUGIN_ID });
  app.openapi(read.route, read.handler);
  app.openapi(write.route, write.handler);

  return { app, events, statements, store, writes };
};

const save = async (app: OpenAPIHono, body: unknown) =>
  await app.request("/layout", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "PUT",
  });

const read = async (app: OpenAPIHono, pageId: string) =>
  await app.request(`/layout?pageId=${encodeURIComponent(pageId)}`);

beforeEach(() => {
  granted = new Set(["can_edit"]);
  grantedPlugin = PLUGIN_ID;
});

describe("route shape", () => {
  it("mounts one public read and one guarded save", () => {
    const routes = buildPageLayoutRoutes({ pluginId: PLUGIN_ID }).map(
      entry => ({
        method: entry.route.method,
        middleware: (entry.route as unknown as { middleware: unknown[] })
          .middleware.length,
        path: entry.route.path,
      }),
    );

    expect(routes).toEqual([
      { method: "get", middleware: 1, path: "/layout" },
      { method: "put", middleware: 1, path: "/layout" },
    ]);
  });
});

describe("GET /layout", () => {
  it("answers the effective layout without asking for a permission", async () => {
    const { app } = harness({
      rows: { "example:settings": { sidebar: [quote("s1", "Stored")] } },
    });
    granted = new Set();

    const response = await read(app, "example:settings");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      pageId: "example:settings",
      updatedAt: STORED_AT.toISOString(),
      zones: {
        "after-profile": [quote("after-shipped", "Shipped after")],
        "before-profile": [hero("shipped", "Shipped default")],
        intro: [text("intro-shipped", "Shipped intro", "prose")],
        sidebar: [quote("s1", "Stored")],
      },
    });
  });

  it("is a 404 for a page id nothing registered", async () => {
    const { app } = harness();

    expect((await read(app, "example:nowhere")).status).toBe(404);
  });

  it("fails rather than answering defaults when the read fails", async () => {
    const { app } = harness({ readFails: true });

    expect((await read(app, "example:settings")).status).toBe(500);
  });
});

describe("PUT /layout", () => {
  it("answers canonically for the submitted zones only, and says so once", async () => {
    const { app, events, writes } = harness({
      rows: { "example:settings": { sidebar: [quote("s1", "Old")] } },
    });

    const response = await save(app, {
      expectedZones: { sidebar: [quote("s1", "Old")] },
      pageId: "example:settings",
      zones: { sidebar: [quote("s1", "New")] },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      pageId: "example:settings",
      zones: { sidebar: [quote("s1", "New")] },
    });
    expect(writes).toEqual(["upsert example:settings"]);
    expect(events).toEqual([
      {
        name: "core.page-layout.updated",
        payload: {
          changedZones: ["sidebar"],
          pageId: "example:settings",
        },
      },
    ]);
  });

  it("writes nothing and emits nothing when the save changes nothing", async () => {
    const { app, events, writes } = harness({
      rows: { "example:settings": { sidebar: [quote("s1", "Same")] } },
    });

    const response = await save(app, {
      expectedZones: { sidebar: [quote("s1", "Same")] },
      pageId: "example:settings",
      zones: { sidebar: [quote("s1", "Same")] },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      updatedAt: STORED_AT.toISOString(),
      zones: { sidebar: [quote("s1", "Same")] },
    });
    expect(writes).toEqual([]);
    expect(events).toEqual([]);
  });

  it("reads and writes inside one locked transaction", async () => {
    const { app, statements } = harness({
      rows: { "example:settings": { sidebar: [quote("s1", "Old")] } },
    });

    expect(
      (
        await save(app, {
          expectedZones: { sidebar: [quote("s1", "Old")] },
          pageId: "example:settings",
          zones: { sidebar: [quote("s1", "New")] },
        })
      ).status,
    ).toBe(200);
    expect(statements).toEqual(["begin", "lock", "select", "upsert"]);
  });

  it("stores nothing when a zone is saved back to its shipped default", async () => {
    const { app, events, writes } = harness();

    const response = await save(app, {
      expectedZones: { intro: [text("intro-shipped", "Shipped intro")] },
      pageId: "example:settings",
      zones: { intro: [text("intro-shipped", "Shipped intro")] },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      updatedAt: null,
      zones: { intro: [text("intro-shipped", "Shipped intro", "prose")] },
    });
    expect(writes).toEqual([]);
    expect(events).toEqual([]);
  });

  it("keeps an area and counts the blocks inside it", async () => {
    const { app, store } = harness();

    const response = await save(app, {
      expectedZones: { "before-profile": [hero("shipped", "Shipped default")] },
      pageId: "example:settings",
      zones: {
        "before-profile": [
          area("a1", [hero("h1", "One"), hero("h2", "Two")]),
          hero("h3", "Three"),
        ],
      },
    });

    expect(response.status).toBe(200);
    expect(store.get("example:settings")?.zones["before-profile"]).toEqual([
      area("a1", [hero("h1", "One"), hero("h2", "Two")]),
      hero("h3", "Three"),
    ]);
  });

  it("keeps a variant the block declares", async () => {
    const { app, store } = harness();

    const response = await save(app, {
      expectedZones: { "before-profile": [hero("shipped", "Shipped default")] },
      pageId: "example:settings",
      zones: { "before-profile": [hero("h1", "Wide", "wide")] },
    });

    expect(response.status).toBe(200);
    expect(store.get("example:settings")?.zones["before-profile"]).toEqual([
      hero("h1", "Wide", "wide"),
    ]);
  });
});

describe("a save built on a zone somebody else already moved", () => {
  it("is a 409, and writes and emits nothing", async () => {
    const { app, events, store, writes } = harness({
      rows: { "example:settings": { sidebar: [quote("s1", "Two")] } },
    });

    const response = await save(app, {
      expectedZones: { sidebar: [quote("s1", "One")] },
      pageId: "example:settings",
      zones: { sidebar: [quote("s1", "Three")] },
    });

    expect(response.status).toBe(409);
    expect(writes).toEqual([]);
    expect(events).toEqual([]);
    expect(store.get("example:settings")?.zones).toEqual({
      sidebar: [quote("s1", "Two")],
    });
    expect(store.get("example:settings")?.updatedAt).toBe(STORED_AT);
  });

  it("is a 200 that writes nothing when it asks for what is already stored", async () => {
    const { app, events, writes } = harness({
      rows: { "example:settings": { sidebar: [quote("s1", "Two")] } },
    });

    const response = await save(app, {
      expectedZones: { sidebar: [quote("s1", "One")] },
      pageId: "example:settings",
      zones: { sidebar: [quote("s1", "Two")] },
    });

    expect(response.status).toBe(200);
    expect(writes).toEqual([]);
    expect(events).toEqual([]);
  });

  it("does not stand in the way of two people editing different zones", async () => {
    const { app, store } = harness({
      rows: {
        "example:settings": {
          "after-profile": [quote("a1", "After one")],
          sidebar: [quote("s1", "Sidebar one")],
        },
      },
    });

    const first = await save(app, {
      expectedZones: { sidebar: [quote("s1", "Sidebar one")] },
      pageId: "example:settings",
      zones: { sidebar: [quote("s1", "Sidebar two")] },
    });
    const second = await save(app, {
      expectedZones: { "after-profile": [quote("a1", "After one")] },
      pageId: "example:settings",
      zones: { "after-profile": [quote("a1", "After two")] },
    });

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(store.get("example:settings")?.zones).toEqual({
      "after-profile": [quote("a1", "After two")],
      sidebar: [quote("s1", "Sidebar two")],
    });
  });

  it("does not refuse the very save that brings a zone back inside its bounds", async () => {
    const overfull = [
      hero("h1", "One"),
      hero("h2", "Two"),
      hero("h3", "Three"),
      hero("h4", "Four"),
    ];
    const { app, store } = harness({
      rows: { "example:settings": { "before-profile": overfull } },
    });

    const response = await save(app, {
      expectedZones: { "before-profile": overfull },
      pageId: "example:settings",
      zones: { "before-profile": [hero("h1", "One")] },
    });

    expect(response.status).toBe(200);
    expect(store.get("example:settings")?.zones["before-profile"]).toEqual([
      hero("h1", "One"),
    ]);
  });

  it("is a 400 when the baselines do not name the very zones being written", async () => {
    const { app, writes } = harness();

    const mismatched = [
      { expectedZones: {}, zones: { sidebar: [quote("s1", "Mine")] } },
      {
        expectedZones: { "before-profile": [], sidebar: [] },
        zones: { sidebar: [quote("s1", "Mine")] },
      },
      {
        expectedZones: { "before-profile": [] },
        zones: { sidebar: [quote("s1", "Mine")] },
      },
    ];

    for (const body of mismatched) {
      expect(
        (await save(app, { ...body, pageId: "example:settings" })).status,
      ).toBe(400);
    }

    expect(writes).toEqual([]);
  });
});

describe("a refused save", () => {
  const refusals: [
    string,
    { pageId: string; zones: Record<string, unknown[]> },
  ][] = [
    [
      "an unknown page id",
      { pageId: "example:nowhere", zones: { sidebar: [] } },
    ],
    ["no zone at all", { pageId: "example:settings", zones: {} }],
    [
      "a zone the page does not declare",
      { pageId: "example:settings", zones: { footer: [quote("f1", "No")] } },
    ],
    [
      "another page's zone",
      { pageId: "example:settings", zones: { header: [quote("h1", "No")] } },
    ],
    [
      "a column name used as a zone",
      { pageId: "example:settings", zones: { zones: [quote("q1", "No")] } },
    ],
    [
      "a zone id off Object.prototype",
      {
        pageId: "example:settings",
        zones: { constructor: [quote("q1", "No")] },
      },
    ],
    [
      "a block nothing registered",
      {
        pageId: "example:settings",
        zones: { sidebar: [{ data: {}, id: "x1", type: "core:missing" }] },
      },
    ],
    [
      "a block the zone does not allow",
      { pageId: "example:settings", zones: { sidebar: [hero("h1", "No")] } },
    ],
    [
      "a variant the block does not declare",
      {
        pageId: "example:settings",
        zones: { "before-profile": [hero("h1", "No", "narrow")] },
      },
    ],
    [
      "an area inside an area",
      {
        pageId: "example:settings",
        zones: {
          "before-profile": [area("a1", [area("a2", [hero("h1", "No")])])],
        },
      },
    ],
    [
      "more blocks than the zone allows, counting area children",
      {
        pageId: "example:settings",
        zones: {
          "before-profile": [
            area("a1", [hero("h1", "One"), hero("h2", "Two")]),
            hero("h3", "Three"),
            hero("h4", "Four"),
          ],
        },
      },
    ],
    [
      "fewer blocks than the zone requires",
      { pageId: "example:settings", zones: { "after-profile": [] } },
    ],
    [
      "a block that is not a block at all",
      { pageId: "example:settings", zones: { sidebar: [{ nope: true }] } },
    ],
    [
      "a malformed block",
      {
        pageId: "example:settings",
        zones: {
          sidebar: [{ data: { text: 12 }, id: "q1", type: "core:quote" }],
        },
      },
    ],
  ];

  it.each(refusals)("is a 400 for %s, and writes nothing", async (_, body) => {
    const { app, events, writes } = harness();

    expect(
      (
        await save(app, {
          ...body,
          expectedZones: Object.fromEntries(
            Object.keys(body.zones).map(zoneId => [zoneId, []]),
          ),
        })
      ).status,
    ).toBe(400);
    expect(writes).toEqual([]);
    expect(events).toEqual([]);
  });

  it("is a 400 for __proto__, and pollutes nothing", async () => {
    const { app, writes } = harness();

    const response = await app.request("/layout", {
      body: '{"pageId":"example:settings","zones":{"__proto__":[]},"expectedZones":{"__proto__":[]}}',
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    });

    expect(response.status).toBe(400);
    expect(writes).toEqual([]);
    expect(({} as unknown as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("permissions", () => {
  it("refuses a caller without the page's permission", async () => {
    const { app, writes } = harness();
    granted = new Set(["can_view"]);

    const response = await save(app, {
      expectedZones: { sidebar: [] },
      pageId: "example:settings",
      zones: { sidebar: [quote("s1", "New")] },
    });

    expect(response.status).toBe(403);
    expect(writes).toEqual([]);
  });

  it("checks the permission before it looks at the zones", async () => {
    const { app } = harness();
    granted = new Set();

    const response = await save(app, {
      expectedZones: { footer: [] },
      pageId: "example:settings",
      zones: { footer: [quote("f1", "Unknown zone")] },
    });

    expect(response.status).toBe(403);
  });

  it("cannot be satisfied by the same permission from another plugin", async () => {
    const { app } = harness();
    grantedPlugin = "@vitnode/blog";

    const response = await save(app, {
      expectedZones: { sidebar: [] },
      pageId: "example:settings",
      zones: { sidebar: [quote("s1", "New")] },
    });

    expect(response.status).toBe(403);
  });

  it("checks each page's own permission", async () => {
    const { app } = harness();

    expect(
      (
        await save(app, {
          expectedZones: { header: [] },
          pageId: "example:forum",
          zones: { header: [quote("h1", "New")] },
        })
      ).status,
    ).toBe(200);

    granted = new Set(["can_moderate"]);

    expect(
      (
        await save(app, {
          expectedZones: { header: [quote("h1", "New")] },
          pageId: "example:forum",
          zones: { header: [quote("h1", "Newer")] },
        })
      ).status,
    ).toBe(403);
  });
});
