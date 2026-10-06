// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it, vi } from "vitest";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";
import type { NavigationPreset } from "@/lib/navigation";

import { expireNavigationCache } from "@/api/modules/admin/navigation/lib/cache";
import { core_languages_words } from "@/database/languages";
import { core_navigation } from "@/database/navigation";
import { createTestCache, createTestCacheClient } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";

import { middlewareModule } from "./middleware.module";

const at = new Date("2026-10-01T00:00:00Z");

const presets: NavigationPreset[] = [
  {
    href: "/discover",
    icon: "icon:compass",
    id: "discover",
    isOpenInNewTab: false,
    pluginId: "@vitnode/core",
  },
];

const navigationRow = (
  id: number,
  overrides: Partial<typeof core_navigation.$inferInsert> = {},
) => ({
  createdAt: at,
  href: null,
  icon: null,
  id,
  isOpenInNewTab: false,
  kind: "custom",
  location: "header",
  parentId: null,
  pluginId: null,
  position: id,
  presetId: null,
  updatedAt: at,
  ...overrides,
});

const titleWord = (itemId: number, value: string) => ({
  itemId,
  languageCode: "en",
  pluginCode: "@vitnode/core",
  tableName: "core_navigation",
  value,
  variable: "title",
});

const core = {
  authorization: {
    passkeys: { enabled: false },
    password: { enabled: true },
    ssoAdapters: [],
  },
  navigation: presets,
  payments: { config: null, offers: new Map() },
} as unknown as Context["var"]["core"];

const ai = { models: () => [] } as unknown as Context["var"]["ai"];

const setup = () => {
  const { db } = createMemoryDb([
    [
      core_navigation,
      [
        navigationRow(1, { href: "/forum" }),
        navigationRow(2, { href: "/forum/latest", parentId: 1 }),
        navigationRow(3, {
          kind: "preset",
          location: "bottom_bar",
          pluginId: "@vitnode/core",
          presetId: "discover",
        }),
      ],
    ],
    [
      core_languages_words,
      [titleWord(1, "Forum"), titleWord(2, "Latest"), titleWord(3, "Discover")],
    ],
  ]);
  const client = createTestCacheClient();
  const cache = createTestCache(client);
  const app = new OpenAPIHono<EnvVitNode>();

  app.use("*", async (c, next) => {
    c.set("ai", ai);
    c.set("cache", cache);
    c.set("core", core);
    c.set("db", db as unknown as Context["var"]["db"]);
    await next();
  });
  app.route("/", middlewareModule.hono);
  app.post("/expire", async c => {
    await expireNavigationCache(c);

    return c.body(null, 204);
  });

  return {
    app,
    cacheGet: vi.spyOn(client, "get"),
    db,
    dbSelect: vi.spyOn(db, "select"),
  };
};

interface MiddlewareBody {
  bottomBar: { href: string; id: number }[];
  navigation: { href: string; id: number; items: { id: number }[] }[];
}

const menusOf = async (res: Response) => {
  expect(res.status).toBe(200);
  const body = (await res.json()) as MiddlewareBody;

  return {
    bottomBar: body.bottomBar.map(item => [item.id, item.href]),
    navigation: body.navigation.map(node => [
      node.id,
      node.href,
      node.items.map(item => item.id),
    ]),
  };
};

describe("GET middleware navigation", () => {
  it("builds navigation and bottom bar from one read and one cache entry", async () => {
    const { app, cacheGet, dbSelect } = setup();

    const first = await menusOf(await app.request("/"));

    expect(first).toEqual({
      bottomBar: [[3, "/discover"]],
      navigation: [[1, "/forum", [2]]],
    });
    expect(dbSelect).toHaveBeenCalledTimes(2);
    expect(cacheGet).toHaveBeenCalledTimes(1);

    const second = await menusOf(await app.request("/"));

    expect(second).toEqual(first);
    expect(dbSelect).toHaveBeenCalledTimes(2);
    expect(cacheGet).toHaveBeenCalledTimes(2);
  });

  it("serves the cached menus until the navigation cache expires", async () => {
    const { app, db } = setup();

    await app.request("/");
    await db
      .insert(core_navigation)
      .values([
        navigationRow(4, { href: "/blog" }),
        navigationRow(5, { href: "/help", location: "bottom_bar" }),
      ]);

    expect(await menusOf(await app.request("/"))).toEqual({
      bottomBar: [[3, "/discover"]],
      navigation: [[1, "/forum", [2]]],
    });

    expect((await app.request("/expire", { method: "POST" })).status).toBe(204);

    expect(await menusOf(await app.request("/"))).toEqual({
      bottomBar: [
        [3, "/discover"],
        [5, "/help"],
      ],
      navigation: [
        [1, "/forum", [2]],
        [4, "/blog", []],
      ],
    });
  });
});
