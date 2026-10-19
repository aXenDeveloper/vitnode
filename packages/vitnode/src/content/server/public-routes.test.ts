import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it, vi } from "vitest";

import { core_content_containers } from "@/database/content-containers";
import {
  testCategoryContentType,
  testPostContentType,
  testThreadContentType,
} from "@/tests/content-fixtures";
import { createMemoryDb } from "@/tests/memory-db";

import { defineContentType } from "../define";
import { field } from "../fields";
import { createContentModel } from "./model";
import { buildContentPublicModule } from "./public-module";
import { buildContentPublicRoutes } from "./public-routes";

// Deliberately NOT mocked: `assertStaffPermission` is never reached, because a
// public route installs no permission middleware. If one ever did, these tests
// would fail on a missing admin session rather than quietly passing.
const categories = createContentModel(testCategoryContentType);
const posts = createContentModel(testPostContentType, {
  references: { category: () => categories.table.id },
});

const PLUGIN_ID = "@vitnode/example";

const publicRow = {
  category: { id: 3 },
  excerpt: "Prose",
  publishedAt: new Date("2026-08-01T09:00:00.000Z"),
  slug: "hello-world",
  title: "Hello world",
};

const emptyPage = {
  edges: [],
  pageInfo: {
    count: 0,
    endCursor: null,
    hasNextPage: false,
    hasPreviousPage: false,
    startCursor: null,
    totalCount: 0,
  },
};

const harness = () => {
  const service = {
    findById: vi.fn(),
    findBySlug: vi.fn(),
    findMany: vi.fn(),
  };

  vi.spyOn(posts, "publicService", "get").mockReturnValue(() => service);

  const app = new OpenAPIHono();
  for (const { handler, route } of buildContentPublicRoutes(posts, {
    pluginId: PLUGIN_ID,
  })) {
    app.openapi(route, handler);
  }

  return { app, service };
};

describe("public list route", () => {
  it("answers without any session at all", async () => {
    const { app, service } = harness();
    service.findMany.mockResolvedValue(emptyPage);

    const response = await app.request("/");

    // The whole point: no staff permission, no admin middleware, no 401.
    expect(response.status).toBe(200);
  });

  it("returns edges and pageInfo", async () => {
    const { app, service } = harness();
    service.findMany.mockResolvedValue({
      ...emptyPage,
      edges: [publicRow],
      pageInfo: { ...emptyPage.pageInfo, count: 1, totalCount: 1 },
    });

    const body = (await (await app.request("/")).json()) as {
      edges: Record<string, unknown>[];
      pageInfo: { totalCount: number };
    };

    expect(body.pageInfo.totalCount).toBe(1);
    expect(Object.keys(body.edges[0]).sort()).toEqual([
      "category",
      "excerpt",
      "publishedAt",
      "slug",
      "title",
    ]);
  });

  it("passes pagination, search, order and filters to the service", async () => {
    const { app, service } = harness();
    service.findMany.mockResolvedValue(emptyPage);

    await app.request(
      "/?first=5&cursor=12&search=hello&order=asc&orderBy=title&category=3",
    );

    expect(service.findMany).toHaveBeenCalledWith({
      filters: { category: 3 },
      orderBy: { column: "title", order: "asc" },
      query: { cursor: "12", first: "5", last: undefined, search: "hello" },
    });
  });

  it("ignores a query parameter it does not recognise", async () => {
    const { app, service } = harness();
    service.findMany.mockResolvedValue(emptyPage);

    // A stale bookmark or a tracking parameter is not a client error.
    const response = await app.request("/?utm_source=newsletter&nope=1");

    expect(response.status).toBe(200);
    expect(service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ filters: {} }),
    );
  });

  it("rejects an order column outside the public allowlist", async () => {
    const { app, service } = harness();
    service.findMany.mockResolvedValue(emptyPage);

    // `views` is private; `createdAt` is orderable in the AdminCP but not here.
    expect((await app.request("/?orderBy=views")).status).toBe(400);
    expect((await app.request("/?orderBy=createdAt")).status).toBe(400);
    expect(service.findMany).not.toHaveBeenCalled();
  });

  it("rejects a malformed filter value", async () => {
    const { app, service } = harness();
    service.findMany.mockResolvedValue(emptyPage);

    expect((await app.request("/?category=banana")).status).toBe(400);
    expect(service.findMany).not.toHaveBeenCalled();
  });

  it("never accepts a private field as a filter", async () => {
    const { app, service } = harness();
    service.findMany.mockResolvedValue(emptyPage);

    await app.request("/?views=10&author=1&status=draft");

    // Not a 400 - the filter schema simply has no such key, so it cannot reach
    // the query builder. Draft-hunting by query string does not work.
    expect(service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ filters: {} }),
    );
  });
});

describe("public list filtered by container", () => {
  const threads = createContentModel(testThreadContentType);
  const PUBLISHED = new Date("2026-08-01T09:00:00.000Z");

  const BOARD = {
    ELSEWHERE: 9,
    GENERAL: 1,
    MISSING: 99,
    NEWS: 3,
    OFF_TOPIC: 2,
    RELEASES: 5,
  } as const;
  const THREAD_IN = {
    [BOARD.GENERAL]: 11,
    [BOARD.NEWS]: 12,
    [BOARD.RELEASES]: 13,
    [BOARD.OFF_TOPIC]: 14,
  };

  const board = (
    id: number,
    parentId: null | number,
    definitionId: string = testThreadContentType.fields.board.definition.id,
  ) => ({
    createdAt: PUBLISHED,
    definitionId,
    id,
    metadata: {},
    name: `Board ${id}`,
    parentId,
    pluginId: PLUGIN_ID,
    position: 0,
    slug: `board-${id}`,
    updatedAt: PUBLISHED,
  });

  const app = (() => {
    const memory = createMemoryDb([
      [
        core_content_containers,
        [
          board(BOARD.GENERAL, null),
          board(BOARD.NEWS, BOARD.GENERAL),
          board(BOARD.RELEASES, BOARD.NEWS),
          board(BOARD.OFF_TOPIC, null),
          board(BOARD.ELSEWHERE, null, "test.sections"),
        ],
      ],
      [
        threads.table,
        Object.entries(THREAD_IN).map(([boardId, id]) => ({
          author: 1,
          board: Number(boardId),
          createdAt: PUBLISHED,
          id,
          publishedAt: PUBLISHED,
          slug: `thread-${id}`,
          status: "published",
          title: `Thread ${id}`,
          updatedAt: PUBLISHED,
        })),
      ],
    ]);
    const instance = new OpenAPIHono();
    instance.use("*", async (c, next) => {
      c.set("db", memory.db as unknown as Context["var"]["db"]);
      await next();
    });
    instance.onError((error, c) =>
      error instanceof HTTPException
        ? error.getResponse()
        : c.json({ error: String(error) }, 500),
    );
    for (const { handler, route } of buildContentPublicRoutes(threads, {
      pluginId: PLUGIN_ID,
    })) {
      instance.openapi(route, handler);
    }

    return instance;
  })();

  const listed = async (query: string) => {
    const response = await app.request(`/${query}`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { edges: { id: number }[] };

    return body.edges.map(edge => edge.id).sort((a, b) => a - b);
  };

  it.each([
    ["one container", `?board=${BOARD.GENERAL}`, [THREAD_IN[BOARD.GENERAL]]],
    [
      "a container and its subtree",
      `?board=${BOARD.GENERAL}&includeDescendants=true`,
      [
        THREAD_IN[BOARD.GENERAL],
        THREAD_IN[BOARD.NEWS],
        THREAD_IN[BOARD.RELEASES],
      ],
    ],
    [
      "a subtree further down",
      `?board=${BOARD.NEWS}&includeDescendants=true`,
      [THREAD_IN[BOARD.NEWS], THREAD_IN[BOARD.RELEASES]],
    ],
    [
      "one container when includeDescendants is false",
      `?board=${BOARD.NEWS}&includeDescendants=false`,
      [THREAD_IN[BOARD.NEWS]],
    ],
    [
      "everything when no container is named",
      "?includeDescendants=true",
      Object.values(THREAD_IN),
    ],
  ])("lists %s", async (_label, query, expected) => {
    await expect(listed(query)).resolves.toEqual(
      [...expected].sort((a, b) => a - b),
    );
  });

  it.each([
    ["does not exist", BOARD.MISSING],
    ["belongs to another collection", BOARD.ELSEWHERE],
  ])("is a 404 for a container that %s", async (_label, id) => {
    expect((await app.request(`/?board=${id}`)).status).toBe(404);
    expect(
      (await app.request(`/?board=${id}&includeDescendants=true`)).status,
    ).toBe(404);
  });

  it("gives a content type without containers no includeDescendants", async () => {
    const { app: postsApp, service } = harness();
    service.findMany.mockResolvedValue(emptyPage);

    const response = await postsApp.request(
      "/?includeDescendants=true&category=3",
    );

    expect(response.status).toBe(200);
    expect(service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ filters: { category: 3 } }),
    );
  });
});

describe("public detail route", () => {
  it("returns a published row", async () => {
    const { app, service } = harness();
    service.findBySlug.mockResolvedValue(publicRow);

    const response = await app.request("/hello-world");

    expect(response.status).toBe(200);
    expect(service.findBySlug).toHaveBeenCalledWith("hello-world", {
      fallback: true,
      locale: undefined,
    });
  });

  it("documents the relation without a label", () => {
    // The response schema is the contract a generated client is built from, so
    // it has to say the same thing the handler does.
    const relation = (
      testPostContentType.schemas.publicSelectObject.shape
        .category as unknown as { shape: Record<string, unknown> }
    ).shape;

    expect(Object.keys(relation)).toEqual(["id"]);
  });

  it("is a 404 for a draft, an unpublished row and a typo alike", async () => {
    const { app, service } = harness();
    // The service returns `null` for all three, so the route cannot tell them
    // apart - and neither can anyone probing for unpublished URLs.
    service.findBySlug.mockResolvedValue(null);

    const response = await app.request("/some-draft");

    expect(response.status).toBe(404);
  });

  it("never answers 403, which would confirm the row exists", async () => {
    const { app, service } = harness();
    service.findBySlug.mockResolvedValue(null);

    expect((await app.request("/some-draft")).status).not.toBe(403);
    expect((await app.request("/some-draft")).status).not.toBe(401);
  });
});

describe("generated surface", () => {
  it("builds only GET routes", () => {
    const routes = buildContentPublicRoutes(posts, { pluginId: PLUGIN_ID });

    expect(routes.map(item => item.route.method)).toEqual(["get", "get"]);
  });

  it("documents only the two read operations", () => {
    const app = new OpenAPIHono();
    for (const { handler, route } of buildContentPublicRoutes(posts, {
      pluginId: PLUGIN_ID,
    })) {
      app.openapi(route, handler);
    }

    const document = app.getOpenAPI31Document({
      info: { title: "test", version: "1" },
      openapi: "3.1.0",
    });
    const paths = document.paths ?? {};

    expect(Object.keys(paths).sort()).toEqual(["/", "/{slug}"]);
    for (const operations of Object.values(paths)) {
      // No post, put, patch or delete anywhere under the public prefix.
      expect(Object.keys(operations ?? {})).toEqual(["get"]);
    }
  });

  it("documents a list row with only `listFields`, and the detail with all", () => {
    const listed = createContentModel(
      defineContentType({
        id: "test.listed",
        tableName: "test_listed",
        fields: {
          title: field.text({ required: true }),
          slug: field.slug({ source: "title" }),
          body: field.textarea({ nullable: true }),
        },
        publication: true,
        publicApi: {
          path: "listed",
          fields: ["title", "slug", "body"],
          listFields: ["title", "slug"],
        },
      }),
    );
    const app = new OpenAPIHono();
    for (const { handler, route } of buildContentPublicRoutes(listed, {
      pluginId: PLUGIN_ID,
    })) {
      app.openapi(route, handler);
    }

    const { paths = {} } = app.getOpenAPI31Document({
      info: { title: "test", version: "1" },
      openapi: "3.1.0",
    });
    interface ObjectSchema {
      properties: Record<string, ObjectSchema & { items: ObjectSchema }>;
    }
    const okSchema = (path: string): ObjectSchema => {
      const response = paths[path]?.get?.responses?.["200"] as
        | undefined
        | { content: { "application/json": { schema: ObjectSchema } } };
      if (!response) throw new Error(`${path} documents no 200 response.`);

      return response.content["application/json"].schema;
    };

    expect(
      Object.keys(okSchema("/").properties.edges.items.properties).sort(),
    ).toEqual(["slug", "title"]);
    expect(Object.keys(okSchema("/{slug}").properties).sort()).toEqual([
      "body",
      "slug",
      "title",
    ]);
  });

  it("installs no staff-permission guard", () => {
    // `buildRoute` always adds `pluginMiddleware`, and adds a second handler
    // only when `adminStaffPermission` is set. Exactly one means none.
    const routes = buildContentPublicRoutes(posts, { pluginId: PLUGIN_ID });

    for (const { route } of routes) {
      // `createRoute` types `middleware` per route config, so read it through
      // the shape `buildRoute` actually assembles.
      const { middleware } = route as unknown as { middleware: unknown[] };

      expect(middleware).toHaveLength(1);
    }
  });
});

describe("buildContentPublicModule", () => {
  it("skips a content type with no public API", () => {
    const module = buildContentPublicModule({
      contentTypes: [posts, categories],
      pluginId: PLUGIN_ID,
    });

    expect(module.modules?.map(item => item.name)).toEqual(["posts"]);
  });

  it("names each sub-module after its public path", () => {
    const module = buildContentPublicModule({
      contentTypes: [posts],
      pluginId: PLUGIN_ID,
    });

    expect(module.name).toBe("content");
    expect(module.modules?.[0].name).toBe(testPostContentType.publicApi.path);
  });

  it("registers no content types", () => {
    // `buildApiPlugin` collects `contentTypes` recursively, so registering them
    // here as well would make `validateContentTypes` throw "Duplicate content
    // type id". Only `buildContentAdminModule` registers.
    const module = buildContentPublicModule({
      contentTypes: [posts, categories],
      pluginId: PLUGIN_ID,
    });

    expect(module.contentTypes).toBeUndefined();
    for (const child of module.modules ?? []) {
      expect(child.contentTypes).toBeUndefined();
    }
  });

  it("has no `/admin/` anywhere in its paths", () => {
    // The global admin gate is a `path.includes("/admin/")` substring test, so
    // a public route that landed under one would demand a staff session.
    const routes = buildContentPublicRoutes(posts, { pluginId: PLUGIN_ID });

    for (const { route } of routes) {
      expect(route.path).not.toContain("admin");
    }
  });
});
