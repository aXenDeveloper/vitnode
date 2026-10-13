import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";

import { core_content_containers } from "@/database/content-containers";
import { testBoardContainers } from "@/tests/content-fixtures";
import { createMemoryDb } from "@/tests/memory-db";

import { buildContentContainerPublicRoutes } from "./public-routes";

const PLUGIN_ID = "@vitnode/example";
const CREATED = new Date("2026-09-01T10:00:00.000Z");

const BOARD = {
  ELSEWHERE: 9,
  GENERAL: 1,
  HELP: 4,
  MISSING: 99,
  NEWS: 3,
  OFF_TOPIC: 2,
  RELEASES: 5,
} as const;

const PRIVATE = { locked: true, notes: "Staff only" };

const row = (
  id: number,
  slug: string,
  parentId: null | number,
  position: number,
  definitionId: string = testBoardContainers.id,
) => ({
  createdAt: CREATED,
  definitionId,
  id,
  metadata: { color: "#ffffff", description: `About ${slug}`, ...PRIVATE },
  name: slug,
  parentId,
  pluginId: PLUGIN_ID,
  position,
  slug,
  updatedAt: CREATED,
});

const SEED = [
  row(BOARD.OFF_TOPIC, "off-topic", null, 1),
  row(BOARD.GENERAL, "general", null, 0),
  row(BOARD.HELP, "help", BOARD.GENERAL, 1),
  row(BOARD.NEWS, "news", BOARD.GENERAL, 0),
  row(BOARD.RELEASES, "releases", BOARD.NEWS, 0),
  row(BOARD.ELSEWHERE, "elsewhere", null, 0, "test.sections"),
];

interface PublicContainer {
  depth: number;
  id: number;
  metadata: Record<string, unknown>;
}

const harness = (seed: readonly object[] = SEED) => {
  const memory = createMemoryDb([[core_content_containers, seed]]);
  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("db", memory.db as unknown as Context["var"]["db"]);
    await next();
  });
  app.onError((error, c) =>
    error instanceof HTTPException
      ? error.getResponse()
      : c.json({ error: String(error) }, 500),
  );
  for (const { handler, route } of buildContentContainerPublicRoutes(
    testBoardContainers,
    { pluginId: PLUGIN_ID },
  )) {
    app.openapi(route, handler);
  }

  return app;
};

const ids = (items: readonly PublicContainer[]) => items.map(item => item.id);

const list = async (query = "") => {
  const response = await harness().request(`/${query}`);
  const body = (await response.json()) as { items: PublicContainer[] };

  return { body, status: response.status };
};

describe("GET /", () => {
  it("lists the collection in tree order, with depths", async () => {
    const { body, status } = await list();

    expect(status).toBe(200);
    expect(body.items.map(item => [item.id, item.depth])).toEqual([
      [BOARD.GENERAL, 1],
      [BOARD.NEWS, 2],
      [BOARD.RELEASES, 3],
      [BOARD.HELP, 2],
      [BOARD.OFF_TOPIC, 1],
    ]);
  });

  it.each([
    ["root", [BOARD.GENERAL, BOARD.OFF_TOPIC]],
    [String(BOARD.GENERAL), [BOARD.NEWS, BOARD.HELP]],
    [String(BOARD.RELEASES), []],
  ])(
    "narrows the list to one level with parent=%s",
    async (parent, expected) => {
      const { body, status } = await list(`?parent=${parent}`);

      expect(status).toBe(200);
      expect(ids(body.items)).toEqual(expected);
    },
  );

  it.each([BOARD.MISSING, BOARD.ELSEWHERE])(
    "is a 404 for parent=%i, which is not in the collection",
    async parent => {
      expect((await harness().request(`/?parent=${parent}`)).status).toBe(404);
    },
  );

  it("answers an empty collection with no items", async () => {
    const response = await harness([]).request("/");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ items: [] });
  });
});

describe("GET /{idOrSlug}", () => {
  it.each([
    ["id", String(BOARD.NEWS)],
    ["slug", "news"],
  ])(
    "returns a container by %s, with its ancestors and children",
    async (_label, segment) => {
      const response = await harness().request(`/${segment}`);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        ancestors: PublicContainer[];
        children: PublicContainer[];
        container: PublicContainer;
      };
      expect(body.container).toEqual({
        depth: 2,
        id: BOARD.NEWS,
        metadata: { color: "#ffffff", description: "About news" },
        name: "news",
        parentId: BOARD.GENERAL,
        position: 0,
        slug: "news",
      });
      expect(ids(body.children)).toEqual([BOARD.RELEASES]);
      expect(ids(body.ancestors)).toEqual([BOARD.GENERAL]);
    },
  );

  it.each([
    String(BOARD.MISSING),
    "nope",
    String(BOARD.ELSEWHERE),
    "elsewhere",
  ])("is a 404 for %s", async segment => {
    expect((await harness().request(`/${segment}`)).status).toBe(404);
  });
});

describe("private metadata", () => {
  it.each(["/", "/?parent=root", `/${BOARD.NEWS}`, "/news"])(
    "never leaves GET %s",
    async path => {
      const text = await (await harness().request(path)).text();

      expect(text).not.toContain("locked");
      expect(text).not.toContain("notes");
      expect(text).not.toContain("Staff only");
      expect(text).not.toContain("createdAt");
    },
  );
});
