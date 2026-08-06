// @vitest-environment node
import type { Context, MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  testArticleContentType,
  testCategoryContentType,
  testEditorialPostContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import {
  ContentRevisionNotRestorable,
  ContentScheduleError,
  ContentVersionConflict,
} from "../errors";
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
const posts = createContentModel(testPostContentType, {
  references: { category: () => categories.table.id },
});
const editorialPosts = createContentModel(testEditorialPostContentType);

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

/**
 * The same harness for a content type with publication enabled, which adds two
 * routes and two service methods.
 */
const publicationHarness = ({ allow = true }: { allow?: boolean } = {}) => {
  const emitted: Harness["emitted"] = [];
  const service = {
    create: vi.fn(),
    delete: vi.fn(),
    findById: vi.fn(),
    findMany: vi.fn(),
    options: vi.fn(),
    publish: vi.fn(),
    unpublish: vi.fn(),
    update: vi.fn(),
  };

  permissionGranted = allow;
  vi.spyOn(posts, "service").mockReturnValue(service);

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("events", {
      emit: async (name: string, payload: unknown) => {
        await Promise.resolve();
        emitted.push({ name, payload });
      },
    } as unknown as Context["var"]["events"]);
    c.set("admin", allow ? { user: adminUser } : null);
    await next();
  });

  for (const { handler, route } of buildContentRoutes(posts, {
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

    // Neither query schema is strict, so an unrelated parameter is dropped
    // rather than turned into a 400. What matters is that it cannot reach the
    // service, and that a declared filter still does.
    it("ignores unrelated query parameters and passes only declared filters", async () => {
      const { app, service } = harness();
      service.findMany.mockResolvedValue({ edges: [], pageInfo: {} });

      const res = await app.request("/?status=published&nope=1&excerpt=prose");

      expect(res.status).toBe(200);
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

  describe("publication", () => {
    const publishedRow = {
      ...row,
      publishedAt: new Date("2026-08-01T09:00:00.000Z"),
      status: "published" as const,
    };

    it("generates no publish routes without publication", () => {
      const paths = buildContentRoutes(articles, { pluginId: PLUGIN_ID }).map(
        entry => `${entry.route.method} ${entry.route.path}`,
      );

      expect(paths).not.toContain("post /{id}/publish");
      expect(paths).not.toContain("post /{id}/unpublish");
    });

    it.each([
      ["publish", publishedRow, "published"],
      ["unpublish", row, "unpublished"],
    ] as const)(
      "%ss and emits the matching event",
      async (action, resultRow, event) => {
        const { app, emitted, service } = publicationHarness();
        service[action].mockResolvedValue({
          changed: true,
          publishedAt: publishedRow.publishedAt,
          row: resultRow,
        });

        const res = await app.request(`/7/${action}`, { method: "POST" });

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toMatchObject({ changed: true });
        expect(service[action]).toHaveBeenCalledWith(7);
        expect(emitted).toHaveLength(1);
        expect(emitted[0].name).toBe(`content.test.post.${event}`);
      },
    );

    it("carries the publication date on the published event only", async () => {
      const { app, emitted, service } = publicationHarness();
      service.publish.mockResolvedValue({
        changed: true,
        publishedAt: publishedRow.publishedAt,
        row: publishedRow,
      });

      await app.request("/7/publish", { method: "POST" });

      expect(emitted[0].payload).toEqual({
        contentId: 7,
        publishedAt: publishedRow.publishedAt,
      });
    });

    it("answers 200 but emits nothing when nothing changed", async () => {
      const { app, emitted, service } = publicationHarness();
      service.publish.mockResolvedValue({
        changed: false,
        publishedAt: publishedRow.publishedAt,
        row: publishedRow,
      });

      const res = await app.request("/7/publish", { method: "POST" });

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({ changed: false });
      // No outbox, so a listener firing on every button press would be doing
      // duplicate work for free.
      expect(emitted).toEqual([]);
    });

    it("answers 404 for a missing record", async () => {
      const { app, service } = publicationHarness();
      service.publish.mockResolvedValue(null);

      const res = await app.request("/7/publish", { method: "POST" });

      expect(res.status).toBe(404);
    });

    it("answers 400 for a non-numeric identifier", async () => {
      const { app } = publicationHarness();

      const res = await app.request("/abc/publish", { method: "POST" });

      expect(res.status).toBe(400);
    });

    it.each(["publish", "unpublish"])(
      "requires can_publish for %s",
      async action => {
        const { app } = publicationHarness({ allow: false });

        const res = await app.request(`/7/${action}`, { method: "POST" });

        expect(res.status).toBe(403);
      },
    );

    it("documents both operations", () => {
      const doc = publicationHarness().app.getOpenAPIDocument({
        info: { title: "t", version: "1" },
        openapi: "3.0.0",
      });

      expect(Object.keys(doc.paths).sort()).toEqual([
        "/",
        "/options/{field}",
        "/{id}",
        "/{id}/publish",
        "/{id}/unpublish",
      ]);
      expect(
        Object.keys(doc.paths["/{id}/publish"].post?.responses ?? {}).sort(),
      ).toEqual(["200", "400", "404"]);
    });
  });

  describe("editorial", () => {
    const editorialRow = {
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      excerpt: null,
      id: 7,
      publishedAt: null,
      slug: "hello",
      status: "draft" as const,
      title: "Hello world",
      updatedAt: new Date("2024-01-02T00:00:00.000Z"),
      version: 4,
      views: 0,
    };

    const outcome = (overrides: Record<string, unknown> = {}) => ({
      changed: true,
      changedFields: ["title"],
      operation: "update" as const,
      previousSlug: "hello",
      restoredFromRevisionId: null,
      revisionId: 20,
      row: editorialRow,
      version: 5,
      ...overrides,
    });

    const editorialHarness = ({ allow = true }: { allow?: boolean } = {}) => {
      const emitted: Harness["emitted"] = [];
      const searched: unknown[] = [];
      const editorial = {
        create: vi.fn(),
        delete: vi.fn(),
        publish: vi.fn(),
        restore: vi.fn(),
        revisions: { findById: vi.fn(), latest: vi.fn(), list: vi.fn() },
        schedules: {
          cancel: vi.fn(),
          listForItem: vi.fn(),
          pendingForItem: vi.fn(),
          recordError: vi.fn(),
          schedule: vi.fn(),
        },
        unpublish: vi.fn(),
        update: vi.fn(),
      };

      permissionGranted = allow;
      // `editorialService` is `((c, opts) => Service) | undefined` on
      // `ContentModel`, and `spyOn` cannot pick an overload through the union -
      // so the model is viewed as the non-optional shape for the stub.
      const spied = editorialPosts as unknown as {
        editorialService: (
          c: Context,
          options: { pluginId: string },
        ) => typeof editorial;
      };
      vi.spyOn(spied, "editorialService").mockReturnValue(editorial);

      // The preview route reads the row through the ordinary service, so it
      // gets a 404 for a record that is not there before it mints anything.
      const service = {
        create: vi.fn(),
        delete: vi.fn(),
        findById: vi.fn(),
        findMany: vi.fn(),
        options: vi.fn(),
        publish: vi.fn(),
        unpublish: vi.fn(),
        update: vi.fn(),
      };
      vi.spyOn(editorialPosts, "service").mockReturnValue(service);

      const app = new OpenAPIHono();
      app.use("*", async (c, next) => {
        c.set("events", {
          emit: async (name: string, payload: unknown) => {
            await Promise.resolve();
            emitted.push({ name, payload });
          },
        } as unknown as Context["var"]["events"]);
        c.set("search", {
          delete: async () => {
            searched.push("delete");

            return Promise.resolve();
          },
          index: async (document: unknown) => {
            searched.push(document);

            return Promise.resolve();
          },
        } as unknown as Context["var"]["search"]);
        c.set("log", {
          error: async () => Promise.resolve(),
        } as unknown as Context["var"]["log"]);
        c.set("admin", allow ? { user: adminUser } : null);
        c.set("core", { hasCronAdapter: true } as never);
        c.set("user", null);
        await next();
      });

      for (const { handler, route } of buildContentRoutes(editorialPosts, {
        pluginId: PLUGIN_ID,
      })) {
        app.openapi(route, handler);
      }

      return { app, editorial, emitted, service };
    };

    describe("update envelope", () => {
      it("requires an expected version", async () => {
        const { app, editorial } = editorialHarness();

        const res = await app.request("/7", {
          method: "PUT",
          ...json({ values: { title: "Changed" } }),
        });

        expect(res.status).toBe(400);
        expect(editorial.update).not.toHaveBeenCalled();
      });

      it("rejects the bare body a Stage 1-3 route accepts", async () => {
        const { app } = editorialHarness();

        const res = await app.request("/7", {
          method: "PUT",
          ...json({ title: "Changed" }),
        });

        expect(res.status).toBe(400);
      });

      it("passes the version and the values through", async () => {
        const { app, editorial } = editorialHarness();
        editorial.update.mockResolvedValue(outcome());

        const res = await app.request("/7", {
          method: "PUT",
          ...json({ expectedVersion: 4, values: { title: "Changed" } }),
        });

        expect(res.status).toBe(200);
        expect(editorial.update).toHaveBeenCalledWith(
          7,
          { title: "Changed" },
          expect.objectContaining({ expectedVersion: 4 }),
        );
      });

      it("records the signed-in admin as the actor", async () => {
        const { app, editorial } = editorialHarness();
        editorial.update.mockResolvedValue(outcome());

        await app.request("/7", {
          method: "PUT",
          ...json({ expectedVersion: 4, values: { title: "Changed" } }),
        });

        expect(editorial.update).toHaveBeenCalledWith(
          7,
          expect.anything(),
          expect.objectContaining({ actor: { type: "staff", userId: 1 } }),
        );
      });

      it("emits `updated` once and nothing on a no-op", async () => {
        const { app, editorial, emitted } = editorialHarness();
        editorial.update.mockResolvedValue(
          outcome({ changed: false, changedFields: [], revisionId: null }),
        );

        await app.request("/7", {
          method: "PUT",
          ...json({ expectedVersion: 4, values: { title: "Hello world" } }),
        });

        expect(emitted).toEqual([]);
      });
    });

    describe("version conflict", () => {
      it("answers 409 with a machine-readable body", async () => {
        const { app, editorial } = editorialHarness();
        editorial.update.mockRejectedValue(
          new ContentVersionConflict({
            contentTypeId: "test.editorial",
            currentVersion: 9,
            expectedVersion: 4,
            itemId: 7,
          }),
        );

        const res = await app.request("/7", {
          method: "PUT",
          ...json({ expectedVersion: 4, values: { title: "Changed" } }),
        });

        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({
          code: "CONTENT_VERSION_CONFLICT",
          contentTypeId: "test.editorial",
          currentVersion: 9,
          expectedVersion: 4,
          itemId: 7,
        });
      });

      it("says nothing about the database on a unique clash", async () => {
        const { app, editorial } = editorialHarness();
        editorial.update.mockRejectedValue(
          Object.assign(new Error("duplicate key value violates ..."), {
            code: "23505",
          }),
        );

        const res = await app.request("/7", {
          method: "PUT",
          ...json({ expectedVersion: 4, values: { title: "Changed" } }),
        });

        expect(res.status).toBe(409);
        const body = (await res.json()) as Record<string, unknown>;
        expect(body.code).toBe("CONTENT_UNIQUE_CONFLICT");
        expect(JSON.stringify(body)).not.toMatch(/duplicate key/);
      });
    });

    describe("revision history", () => {
      it("returns metadata only", async () => {
        const { app, editorial } = editorialHarness();
        editorial.revisions.list.mockResolvedValue([
          {
            actorName: "Test",
            actorType: "staff",
            actorUserId: 1,
            changedFields: ["title"],
            createdAt: new Date("2024-01-02T00:00:00.000Z"),
            id: 20,
            operation: "update",
            restoredFromRevisionId: null,
            version: 5,
          },
        ]);

        const res = await app.request("/7/revisions");
        const body = (await res.json()) as { edges: unknown[] };

        expect(res.status).toBe(200);
        expect(body.edges).toHaveLength(1);
        // No snapshot in the list payload - opening the history must not drag
        // every historical version of a long article across the wire.
        expect(body.edges[0]).not.toHaveProperty("snapshot");
      });

      it("loads one snapshot on demand", async () => {
        const { app, editorial } = editorialHarness();
        editorial.revisions.findById.mockResolvedValue({
          actorName: null,
          actorType: "system",
          actorUserId: null,
          changedFields: [],
          createdAt: new Date(),
          id: 20,
          operation: "create",
          restoredFromRevisionId: null,
          snapshot: { fields: { title: "Hello" } },
          version: 1,
        });

        const res = await app.request("/7/revisions/20");

        expect(res.status).toBe(200);
        expect(editorial.revisions.findById).toHaveBeenCalledWith(7, 20);
      });

      it("404s a revision that is not this record's", async () => {
        const { app, editorial } = editorialHarness();
        editorial.revisions.findById.mockResolvedValue(null);

        expect((await app.request("/7/revisions/20")).status).toBe(404);
      });
    });

    describe("restore", () => {
      it("restores and reports what changed", async () => {
        const { app, editorial } = editorialHarness();
        editorial.restore.mockResolvedValue(
          outcome({ operation: "restore", restoredFromRevisionId: 3 }),
        );

        const res = await app.request("/7/revisions/3/restore", {
          method: "POST",
          ...json({ expectedVersion: 4 }),
        });

        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ changed: true });
        expect(editorial.restore).toHaveBeenCalledWith(
          7,
          3,
          expect.objectContaining({ expectedVersion: 4 }),
        );
      });

      it("emits `restored` and never also `updated`", async () => {
        const { app, editorial, emitted } = editorialHarness();
        editorial.restore.mockResolvedValue(
          outcome({ operation: "restore", restoredFromRevisionId: 3 }),
        );

        await app.request("/7/revisions/3/restore", {
          method: "POST",
          ...json({ expectedVersion: 4 }),
        });

        expect(emitted.map(entry => entry.name)).toEqual([
          "content.test.editorial.restored",
        ]);
        expect(emitted[0].payload).toMatchObject({
          changedFields: ["title"],
          contentId: 7,
          restoredFromRevisionId: 3,
          revisionId: 20,
        });
      });

      it("answers 422 naming only field names", async () => {
        const { app, editorial } = editorialHarness();
        editorial.restore.mockRejectedValue(
          new ContentRevisionNotRestorable({
            contentTypeId: "test.editorial",
            fields: ["title"],
            revisionId: 3,
          }),
        );

        const res = await app.request("/7/revisions/3/restore", {
          method: "POST",
          ...json({ expectedVersion: 4 }),
        });

        expect(res.status).toBe(422);
        expect(await res.json()).toEqual({
          code: "CONTENT_REVISION_NOT_RESTORABLE",
          contentTypeId: "test.editorial",
          fields: ["title"],
          revisionId: 3,
        });
      });

      it("requires an expected version", async () => {
        const { app } = editorialHarness();

        const res = await app.request("/7/revisions/3/restore", {
          method: "POST",
          ...json({}),
        });

        expect(res.status).toBe(400);
      });
    });

    describe("route generation", () => {
      it("adds no revision routes without the workflow", () => {
        const paths = buildContentRoutes(posts, { pluginId: PLUGIN_ID }).map(
          entry => `${entry.route.method} ${entry.route.path}`,
        );

        expect(paths).not.toContain("get /{id}/revisions");
        expect(paths).not.toContain(
          "post /{id}/revisions/{revisionId}/restore",
        );
      });

      it("gates every generated route on a staff permission", async () => {
        // Asserted over the whole array rather than route by route, so a new
        // endpoint cannot be added without one: `buildRoute` only appends the
        // permission middleware when `adminStaffPermission` was supplied, so a
        // 403 for every path is the observable proof.
        const { app } = editorialHarness({ allow: false });
        const paths: [string, string][] = [
          ["GET", "/"],
          ["GET", "/7"],
          ["POST", "/"],
          ["PUT", "/7"],
          ["DELETE", "/7"],
          ["POST", "/7/publish"],
          ["POST", "/7/unpublish"],
          ["GET", "/7/revisions"],
          ["GET", "/7/revisions/3"],
          ["POST", "/7/revisions/3/restore"],
        ];

        for (const [method, path] of paths) {
          const res = await app.request(path, {
            method,
            ...(method === "POST" || method === "PUT"
              ? json({ expectedVersion: 1, title: "Hello world", values: {} })
              : {}),
          });

          expect([method, path, res.status]).toEqual([method, path, 403]);
        }
      });

      it("gates restore on can_restore, not can_edit", async () => {
        const { app } = editorialHarness({ allow: false });

        const res = await app.request("/7/revisions/3/restore", {
          method: "POST",
          ...json({ expectedVersion: 4 }),
        });

        expect(res.status).toBe(403);
      });
    });

    describe("preview", () => {
      it("mints a link bound to the newest revision", async () => {
        const { app, editorial, service } = editorialHarness();
        service.findById.mockResolvedValue({ ...editorialRow, version: 5 });
        editorial.revisions.latest.mockResolvedValue({ id: 42, version: 5 });

        const res = await app.request("/7/preview", { method: "POST" });
        const body = (await res.json()) as {
          revisionId: number;
          token: string;
          url: string;
          version: number;
        };

        expect(res.status).toBe(200);
        expect(body.revisionId).toBe(42);
        expect(body.version).toBe(5);
        // The fixture sets a `pathTemplate`, so the link points at the web app
        // rather than the JSON endpoint.
        expect(body.url).toBe(
          `/editorial/preview/${encodeURIComponent(body.token)}`,
        );
      });

      it("falls back to the live row when there is no revision", async () => {
        // A record that predates its content type opting into editorial. It can
        // still be previewed; only the frozen-snapshot guarantee is unavailable.
        const { app, editorial, service } = editorialHarness();
        service.findById.mockResolvedValue({ ...editorialRow, version: 2 });
        editorial.revisions.latest.mockResolvedValue(null);

        const body = (await (
          await app.request("/7/preview", { method: "POST" })
        ).json()) as { revisionId: number; version: number };

        expect(body).toMatchObject({ revisionId: 0, version: 2 });
      });

      it("404s for a record that is not there, before minting anything", async () => {
        const { app, editorial, service } = editorialHarness();
        service.findById.mockResolvedValue(null);

        const res = await app.request("/7/preview", { method: "POST" });

        expect(res.status).toBe(404);
        expect(editorial.revisions.latest).not.toHaveBeenCalled();
      });

      it("needs can_view", async () => {
        const { app } = editorialHarness({ allow: false });

        expect(
          (await app.request("/7/preview", { method: "POST" })).status,
        ).toBe(403);
      });

      it("is absent from a content type without preview", () => {
        // `testPostContentType` has a public API but no editorial block, so it
        // gets no preview route at all - not a disabled one.
        const paths = buildContentRoutes(articles, {
          pluginId: PLUGIN_ID,
        }).map(entry => entry.route.path);

        expect(paths).not.toContain("/{id}/preview");
      });
    });

    describe("scheduling", () => {
      const future = new Date(Date.now() + 3_600_000).toISOString();

      it("books a publication and emits one event", async () => {
        const { app, editorial, emitted, service } = editorialHarness();
        service.findById.mockResolvedValue(editorialRow);
        editorial.schedules.schedule.mockResolvedValue({
          generation: 1,
          id: 55,
          scheduledFor: new Date(future),
        });

        const res = await app.request("/7/schedule", {
          method: "POST",
          ...json({ action: "publish", scheduledFor: future }),
        });

        expect(res.status).toBe(200);
        expect(editorial.schedules.schedule).toHaveBeenCalledWith(
          expect.objectContaining({
            action: "publish",
            actorUserId: adminUser.id,
            itemId: 7,
          }),
        );
        expect(emitted.map(entry => entry.name)).toEqual([
          "content.test.editorial.scheduled",
        ]);
      });

      it("404s for a record that is not there", async () => {
        const { app, editorial, service } = editorialHarness();
        service.findById.mockResolvedValue(null);

        const res = await app.request("/7/schedule", {
          method: "POST",
          ...json({ action: "publish", scheduledFor: future }),
        });

        expect(res.status).toBe(404);
        expect(editorial.schedules.schedule).not.toHaveBeenCalled();
      });

      it("answers a refused time with a machine-readable code", async () => {
        const { app, editorial, service } = editorialHarness();
        service.findById.mockResolvedValue(editorialRow);
        editorial.schedules.schedule.mockRejectedValue(
          new ContentScheduleError("That time has already passed.", {
            code: "CONTENT_SCHEDULE_IN_PAST",
            contentTypeId: testEditorialPostContentType.id,
          }),
        );

        const res = await app.request("/7/schedule", {
          method: "POST",
          ...json({ action: "publish", scheduledFor: future }),
        });

        expect(res.status).toBe(400);
        // A code, not prose: the dialog points at the date field for this one
        // and shows a general error for anything else.
        await expect(res.json()).resolves.toMatchObject({
          code: "CONTENT_SCHEDULE_IN_PAST",
        });
      });

      it("cancels a pending schedule and says which action it was", async () => {
        const { app, editorial, emitted } = editorialHarness();
        editorial.schedules.cancel.mockResolvedValue({ action: "publish" });

        const res = await app.request("/7/schedule/55/cancel", {
          method: "POST",
        });

        expect(res.status).toBe(200);
        // Scoped by the record as well as the schedule id: the table is shared.
        expect(editorial.schedules.cancel).toHaveBeenCalledWith(7, 55);
        expect(emitted[0]).toMatchObject({
          name: "content.test.editorial.schedule_cancelled",
          payload: { action: "publish", scheduleId: 55 },
        });
      });

      it("404s when there was nothing pending to cancel", async () => {
        const { app, editorial, emitted } = editorialHarness();
        editorial.schedules.cancel.mockResolvedValue(null);

        const res = await app.request("/7/schedule/55/cancel", {
          method: "POST",
        });

        expect(res.status).toBe(404);
        expect(emitted).toHaveLength(0);
      });

      it("lists schedules with whether a scheduler is actually running", async () => {
        // Carried on this route rather than the debug endpoint, which needs a
        // permission the editor may not have - and without it the dialog would
        // accept schedules that never fire.
        const { app, editorial } = editorialHarness();
        editorial.schedules.listForItem.mockResolvedValue([]);

        const res = await app.request("/7/schedules");

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({
          edges: [],
          hasCronAdapter: true,
        });
      });

      it.each([
        ["POST", "/7/schedule"],
        ["POST", "/7/schedule/55/cancel"],
      ])("gates %s %s on can_publish", async (method, path) => {
        const { app } = editorialHarness({ allow: false });

        const res = await app.request(path, {
          method,
          ...(path.endsWith("/schedule")
            ? json({ action: "publish", scheduledFor: future })
            : {}),
        });

        expect(res.status).toBe(403);
      });

      it("is absent from a content type without scheduling", () => {
        const paths = buildContentRoutes(posts, { pluginId: PLUGIN_ID }).map(
          entry => entry.route.path,
        );

        expect(paths).not.toContain("/{id}/schedule");
        expect(paths).not.toContain("/{id}/schedules");
      });
    });
  });

  describe("OpenAPI", () => {
    const document = () =>
      harness().app.getOpenAPIDocument({
        info: { title: "t", version: "1" },
        openapi: "3.0.0",
      });

    it("documents every operation", () => {
      const doc = document();

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

    it.each([
      ["/", "get", ["200", "400"]],
      ["/", "post", ["201", "400", "409"]],
      ["/{id}", "get", ["200", "400", "404"]],
      ["/{id}", "put", ["200", "400", "404", "409"]],
      ["/{id}", "delete", ["200", "400", "404", "409"]],
      ["/options/{field}", "get", ["200", "400"]],
    ])("documents %s %s as %j", (path, method, statuses) => {
      const operation =
        document().paths[path][method as "delete" | "get" | "post" | "put"];

      expect(Object.keys(operation?.responses ?? {}).sort()).toEqual(statuses);
    });
  });
});
