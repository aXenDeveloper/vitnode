// @vitest-environment node
import type { Context, MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  testArticleContentType,
  testCategoryContentType,
} from "@/tests/content-fixtures";

import { createContentModel } from "./model";
import { buildContentRoutes } from "./routes";

let permissionGranted = true;

// `assertStaffPermission` reads roles out of the database. The routes' job is
// to *call* it with the right module and permission, so the check itself is
// replaced with a switchable verdict.
vi.mock("../../api/lib/check-staff-permission", () => ({
  assertStaffPermission: async () => {
    if (!permissionGranted) {
      const { HTTPException } = await import("hono/http-exception");
      throw new HTTPException(403, { message: "Forbidden" });
    }
  },
}));

const categories = createContentModel(testCategoryContentType);
const articles = createContentModel(testArticleContentType, {
  references: { category: () => categories.table.id },
});

const PLUGIN_ID = "@vitnode/example";

const adminUser = {
  avatarColor: "000000",
  birthday: null,
  createdAt: new Date(),
  email: "test@test.com",
  emailVerified: true,
  id: 1,
  language: "en",
  name: "Test",
  nameCode: "test",
  newsletter: false,
  roleId: 1,
};

interface Harness {
  app: OpenAPIHono;
  emitted: { name: string; payload: unknown }[];
  service: Record<string, ReturnType<typeof vi.fn>>;
}

/**
 * Mounts the generated routes with the service and permission check stubbed,
 * so each test drives the real Hono pipeline (validation, status codes, error
 * mapping) without a database.
 */
const harness = ({ allow = true }: { allow?: boolean } = {}): Harness => {
  const emitted: Harness["emitted"] = [];
  const service = {
    create: vi.fn(),
    delete: vi.fn(),
    findById: vi.fn(),
    findMany: vi.fn(),
    options: vi.fn(),
    update: vi.fn(),
  };

  permissionGranted = allow;
  vi.spyOn(articles, "service").mockReturnValue(service);

  const app = new OpenAPIHono();

  // Stands in for `globalMiddleware` + the admin session middleware.
  const context: MiddlewareHandler = async (c, next) => {
    c.set("events", {
      emit: async (name: string, payload: unknown) => {
        await Promise.resolve();
        emitted.push({ name, payload });
      },
    } as unknown as Context["var"]["events"]);
    c.set("admin", allow ? { user: adminUser } : null);
    await next();
  };
  app.use("*", context);

  for (const { handler, route } of buildContentRoutes(articles, {
    pluginId: PLUGIN_ID,
  })) {
    app.openapi(route, handler);
  }

  return { app, emitted, service };
};

const json = (body: unknown) => ({
  body: JSON.stringify(body),
  headers: { "Content-Type": "application/json" },
});

const row = {
  author: null,
  category: 1,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  excerpt: null,
  featured: false,
  id: 7,
  publishedAt: null,
  status: "draft" as const,
  title: "Hello world",
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  views: 0,
};

describe("generated content routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("list", () => {
    it("returns edges and pageInfo", async () => {
      const { app, service } = harness();
      service.findMany.mockResolvedValue({
        edges: [{ ...row, labels: { author: null, category: "News" } }],
        pageInfo: {
          count: 1,
          endCursor: 7,
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: 7,
          totalCount: 1,
        },
      });

      const res = await app.request("/");

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({
        edges: [{ id: 7, labels: { category: "News" } }],
      });
    });

    it("passes pagination and search through to the service", async () => {
      const { app, service } = harness();
      service.findMany.mockResolvedValue({ edges: [], pageInfo: {} });

      await app.request("/?first=5&search=hello&cursor=3");

      expect(service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          query: { cursor: "3", first: "5", last: undefined, search: "hello" },
        }),
      );
    });

    it("passes only declared filters through", async () => {
      const { app, service } = harness();
      service.findMany.mockResolvedValue({ edges: [], pageInfo: {} });

      await app.request("/?status=published&nope=1");

      expect(service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ filters: { status: "published" } }),
      );
    });

    it("rejects an order column outside the allowlist", async () => {
      const { app } = harness();

      const res = await app.request("/?orderBy=views");

      expect(res.status).toBe(400);
    });

    it("accepts an allowlisted order column", async () => {
      const { app, service } = harness();
      service.findMany.mockResolvedValue({ edges: [], pageInfo: {} });

      const res = await app.request("/?orderBy=title&order=asc");

      expect(res.status).toBe(200);
      expect(service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { column: "title", order: "asc" } }),
      );
    });
  });

  describe("detail", () => {
    it("returns the row", async () => {
      const { app, service } = harness();
      service.findById.mockResolvedValue(row);

      const res = await app.request("/7");

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({ id: 7 });
    });

    it("returns 404 for a missing row", async () => {
      const { app, service } = harness();
      service.findById.mockResolvedValue(null);

      expect((await app.request("/7")).status).toBe(404);
    });

    it("rejects a non-numeric identifier", async () => {
      const { app } = harness();

      expect((await app.request("/abc")).status).toBe(400);
    });
  });

  describe("create", () => {
    it("returns 201 and emits after the write", async () => {
      const { app, emitted, service } = harness();
      service.create.mockResolvedValue(row);

      const res = await app.request("/", {
        method: "POST",
        ...json({ category: 1, title: "Hello world" }),
      });

      expect(res.status).toBe(201);
      expect(emitted).toEqual([
        { name: "content.test.article.created", payload: { contentId: 7 } },
      ]);
    });

    it("returns 400 and emits nothing when validation fails", async () => {
      const { app, emitted, service } = harness();

      const res = await app.request("/", {
        method: "POST",
        ...json({ category: 1, title: "no" }),
      });

      expect(res.status).toBe(400);
      expect(service.create).not.toHaveBeenCalled();
      expect(emitted).toEqual([]);
    });

    it("rejects unknown keys", async () => {
      const { app } = harness();

      const res = await app.request("/", {
        method: "POST",
        ...json({ category: 1, slug: "nope", title: "Hello world" }),
      });

      expect(res.status).toBe(400);
    });

    it("rejects an attempt to set a system column", async () => {
      const { app } = harness();

      const res = await app.request("/", {
        method: "POST",
        ...json({ category: 1, id: 99, title: "Hello world" }),
      });

      expect(res.status).toBe(400);
    });

    it("maps a foreign key violation to 400 without leaking the driver message", async () => {
      const { app, service } = harness();
      service.create.mockRejectedValue(
        Object.assign(
          new Error('insert violates "example_articles_category_fkey"'),
          {
            code: "23503",
          },
        ),
      );

      const res = await app.request("/", {
        method: "POST",
        ...json({ category: 999, title: "Hello world" }),
      });

      expect(res.status).toBe(400);
      expect(await res.text()).not.toContain("fkey");
    });
  });

  describe("update", () => {
    it("returns 200 and emits the changed fields", async () => {
      const { app, emitted, service } = harness();
      service.update.mockResolvedValue({
        changedFields: ["title"],
        row: { ...row, title: "Changed" },
      });

      const res = await app.request("/7", {
        method: "PUT",
        ...json({ title: "Changed" }),
      });

      expect(res.status).toBe(200);
      expect(emitted).toEqual([
        {
          name: "content.test.article.updated",
          payload: { changedFields: ["title"], contentId: 7 },
        },
      ]);
    });

    it("rejects an empty payload", async () => {
      const { app, service } = harness();

      const res = await app.request("/7", { method: "PUT", ...json({}) });

      expect(res.status).toBe(400);
      expect(service.update).not.toHaveBeenCalled();
    });

    it("returns 404 for a missing row", async () => {
      const { app, service } = harness();
      service.update.mockResolvedValue(null);

      const res = await app.request("/7", {
        method: "PUT",
        ...json({ title: "Changed" }),
      });

      expect(res.status).toBe(404);
    });

    it("does not emit when nothing actually changed", async () => {
      const { app, emitted, service } = harness();
      service.update.mockResolvedValue({ changedFields: [], row });

      await app.request("/7", {
        method: "PUT",
        ...json({ title: "Hello world" }),
      });

      expect(emitted).toEqual([]);
    });
  });

  describe("delete", () => {
    it("returns 200 and emits after the write", async () => {
      const { app, emitted, service } = harness();
      service.delete.mockResolvedValue(row);

      expect((await app.request("/7", { method: "DELETE" })).status).toBe(200);
      expect(emitted).toEqual([
        { name: "content.test.article.deleted", payload: { contentId: 7 } },
      ]);
    });

    it("returns 404 for a missing row", async () => {
      const { app, service } = harness();
      service.delete.mockResolvedValue(null);

      expect((await app.request("/7", { method: "DELETE" })).status).toBe(404);
    });

    it("maps a restricted foreign key to 409", async () => {
      const { app, service } = harness();
      service.delete.mockRejectedValue(
        Object.assign(new Error("still referenced"), { code: "23503" }),
      );

      const res = await app.request("/7", { method: "DELETE" });

      expect(res.status).toBe(409);
    });
  });

  describe("options", () => {
    it("returns picker options", async () => {
      const { app, service } = harness();
      service.options.mockResolvedValue([{ label: "News", value: 3 }]);

      const res = await app.request("/options/category?search=ne");

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
        items: [{ label: "News", value: 3 }],
      });
      expect(service.options).toHaveBeenCalledWith("category", "ne");
    });
  });

  describe("staff permissions", () => {
    it.each([
      ["GET", "/"],
      ["GET", "/7"],
      ["GET", "/options/category"],
      ["POST", "/"],
      ["PUT", "/7"],
      ["DELETE", "/7"],
    ])("returns 403 for %s %s without permission", async (method, path) => {
      const { app } = harness({ allow: false });

      const res = await app.request(path, {
        method,
        ...(method === "POST" || method === "PUT"
          ? json({ title: "Hello world", category: 1 })
          : {}),
      });

      expect(res.status).toBe(403);
    });
  });

  describe("OpenAPI", () => {
    it("documents every operation", () => {
      const { app } = harness();
      const doc = app.getOpenAPIDocument({
        info: { title: "t", version: "1" },
        openapi: "3.0.0",
      });

      expect(Object.keys(doc.paths).sort()).toEqual([
        "/",
        "/options/{field}",
        "/{id}",
      ]);
      expect(Object.keys(doc.paths["/{id}"]).sort()).toEqual([
        "delete",
        "get",
        "put",
      ]);
    });
  });
});
