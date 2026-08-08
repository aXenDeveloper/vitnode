// @vitest-environment node
import type { Context, MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  testCategoryContentType,
  testPostContentType,
  testSearchablePostContentType,
} from "@/tests/content-fixtures";

import { createContentModel } from "./model";
import { buildContentRoutes } from "./routes";

vi.mock("../../api/lib/check-staff-permission", () => ({
  assertStaffPermission: async () => {
    await Promise.resolve();
  },
}));

const categories = createContentModel(testCategoryContentType);
const searchable = createContentModel(testSearchablePostContentType);
const plain = createContentModel(testPostContentType, {
  references: { category: () => categories.table.id },
});

const PLUGIN_ID = "@vitnode/example";

const PUBLISHED_AT = new Date("2026-02-01T10:00:00.000Z");
const CREATED_AT = new Date("2026-01-01T00:00:00.000Z");

const publishedRow = {
  author: 3,
  body: "Body copy.",
  code: "SECRET",
  createdAt: CREATED_AT,
  excerpt: "Excerpt.",
  id: 7,
  publishedAt: PUBLISHED_AT,
  slug: "hello-world",
  status: "published" as const,
  title: "Hello world",
  updatedAt: CREATED_AT,
  views: 0,
};

const draftRow = {
  ...publishedRow,
  publishedAt: null,
  status: "draft" as const,
};

/**
 * The generated routes with the service, the search engine and the logger
 * stubbed, so each case drives the real handler and asserts on what reached
 * `c.get("search")`.
 */
const harness = ({
  logFails = false,
  model = searchable,
  searchFails = false,
}: {
  logFails?: boolean;
  model?: typeof plain | typeof searchable;
  searchFails?: boolean;
} = {}) => {
  const logged: string[] = [];
  const search = {
    delete: vi.fn(async () => {
      if (searchFails) throw new Error("engine unavailable");
      await Promise.resolve();
    }),
    index: vi.fn(async () => {
      if (searchFails) throw new Error("engine unavailable");
      await Promise.resolve();
    }),
  };
  const service = {
    create: vi.fn(),
    delete: vi.fn(),
    advanced: vi.fn(),
    findDetail: vi.fn(),
    findById: vi.fn(),
    relations: {},
    repeatable: {},
    findMany: vi.fn(),
    options: vi.fn(),
    publish: vi.fn(),
    unpublish: vi.fn(),
    update: vi.fn(),
  };

  vi.spyOn(model, "service").mockReturnValue(service);

  const app = new OpenAPIHono();
  const context: MiddlewareHandler = async (c, next) => {
    c.set("events", {
      emit: async () => {
        await Promise.resolve();
      },
    } as unknown as Context["var"]["events"]);
    c.set("search", search as unknown as Context["var"]["search"]);
    c.set("log", {
      debug: async () => {
        await Promise.resolve();
      },
      error: async (content: string) => {
        await Promise.resolve();
        logged.push(content);
        if (logFails) throw new Error("core_logs unavailable");
      },
      warn: async () => {
        await Promise.resolve();
      },
    });
    c.set("admin", { user: { id: 1 } } as unknown as Context["var"]["admin"]);
    await next();
  };
  app.use("*", context);

  // The two fixtures are structurally different content types, and the harness
  // only needs their routes - so the union collapses here rather than making
  // every caller generic.
  for (const { handler, route } of buildContentRoutes(
    model as typeof searchable,
    { pluginId: PLUGIN_ID },
  )) {
    app.openapi(route, handler);
  }

  return { app, logged, search, service };
};

const json = (body: unknown) => ({
  body: JSON.stringify(body),
  headers: { "Content-Type": "application/json" },
});

describe("content search lifecycle synchronization", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("create", () => {
    it("indexes nothing for a new draft", async () => {
      const { app, search, service } = harness();
      service.create.mockResolvedValue(draftRow);

      const res = await app.request("/", {
        ...json({ code: "a", slug: "hello-world", title: "Hello world" }),
        method: "POST",
      });

      expect(res.status).toBe(201);
      expect(search.index).not.toHaveBeenCalled();
      expect(search.delete).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("indexes nothing for a draft", async () => {
      const { app, search, service } = harness();
      service.update.mockResolvedValue({
        changedFields: ["title"],
        row: draftRow,
      });

      const res = await app.request("/7", {
        ...json({ title: "Changed" }),
        method: "PUT",
      });

      expect(res.status).toBe(200);
      expect(search.index).not.toHaveBeenCalled();
    });

    it("upserts when a published record's indexed field changes", async () => {
      const { app, search, service } = harness();
      service.update.mockResolvedValue({
        changedFields: ["title"],
        row: publishedRow,
      });

      await app.request("/7", { ...json({ title: "Changed" }), method: "PUT" });

      expect(search.index).toHaveBeenCalledTimes(1);
      expect(search.index).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: 7,
          itemType: "test.searchable",
          title: "Hello world",
        }),
      );
    });

    it("indexes nothing when only a non-indexed field changes", async () => {
      const { app, search, service } = harness();
      service.update.mockResolvedValue({
        changedFields: ["views"],
        row: publishedRow,
      });

      await app.request("/7", { ...json({ views: 1 }), method: "PUT" });

      expect(search.index).not.toHaveBeenCalled();
    });

    it("rewrites the url when the slug changes", async () => {
      const { app, search, service } = harness();
      service.update.mockResolvedValue({
        changedFields: ["slug"],
        row: { ...publishedRow, slug: "renamed" },
      });

      await app.request("/7", { ...json({ slug: "renamed" }), method: "PUT" });

      expect(search.index).toHaveBeenCalledWith(
        expect.objectContaining({ url: "/searchable/renamed" }),
      );
      // No stale document: the key is the item type and id, not the url.
      expect(search.delete).not.toHaveBeenCalled();
    });

    it("removes the document when a published record stops being indexable", async () => {
      const { app, search, service } = harness();
      // Still published, but there is no longer a title to show in a result.
      service.update.mockResolvedValue({
        changedFields: ["title"],
        row: { ...publishedRow, title: "   " },
      });

      await app.request("/7", { ...json({ title: "   " }), method: "PUT" });

      expect(search.delete).toHaveBeenCalledWith("test.searchable", 7);
      expect(search.index).not.toHaveBeenCalled();
    });

    it("indexes nothing when nothing changed", async () => {
      const { app, search, service } = harness();
      service.update.mockResolvedValue({
        changedFields: [],
        row: publishedRow,
      });

      await app.request("/7", {
        ...json({ title: "Hello world" }),
        method: "PUT",
      });

      expect(search.index).not.toHaveBeenCalled();
    });
  });

  describe("publish", () => {
    it("upserts once on a real transition", async () => {
      const { app, search, service } = harness();
      service.publish.mockResolvedValue({
        changed: true,
        publishedAt: PUBLISHED_AT,
        row: publishedRow,
      });

      const res = await app.request("/7/publish", { method: "POST" });

      expect(res.status).toBe(200);
      expect(search.index).toHaveBeenCalledTimes(1);
      expect(search.index).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Excerpt.\n\nBody copy.",
          createdAt: PUBLISHED_AT,
          isPublic: true,
          // Stamped by the route, so a rebuild reproduces the same ownership.
          pluginId: PLUGIN_ID,
          url: "/searchable/hello-world",
        }),
      );
    });

    it("does nothing when the record was already published", async () => {
      const { app, search, service } = harness();
      service.publish.mockResolvedValue({
        changed: false,
        publishedAt: PUBLISHED_AT,
        row: publishedRow,
      });

      await app.request("/7/publish", { method: "POST" });

      expect(search.index).not.toHaveBeenCalled();
      expect(search.delete).not.toHaveBeenCalled();
    });
  });

  describe("unpublish", () => {
    it("deletes the document on a real transition", async () => {
      const { app, search, service } = harness();
      service.unpublish.mockResolvedValue({
        changed: true,
        publishedAt: PUBLISHED_AT,
        row: { ...publishedRow, status: "draft" as const },
      });

      await app.request("/7/unpublish", { method: "POST" });

      expect(search.delete).toHaveBeenCalledTimes(1);
      expect(search.delete).toHaveBeenCalledWith("test.searchable", 7);
      expect(search.index).not.toHaveBeenCalled();
    });

    it("does nothing when the record was already a draft", async () => {
      const { app, search, service } = harness();
      service.unpublish.mockResolvedValue({
        changed: false,
        publishedAt: null,
        row: draftRow,
      });

      await app.request("/7/unpublish", { method: "POST" });

      expect(search.delete).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("deletes the document for a published record", async () => {
      const { app, search, service } = harness();
      service.delete.mockResolvedValue(publishedRow);

      await app.request("/7", { method: "DELETE" });

      expect(search.delete).toHaveBeenCalledWith("test.searchable", 7);
    });

    it("deletes defensively for a record that was published before", async () => {
      const { app, search, service } = harness();
      // `publishedAt` survives an unpublish, so this row was indexed once.
      service.delete.mockResolvedValue({
        ...publishedRow,
        status: "draft" as const,
      });

      await app.request("/7", { method: "DELETE" });

      expect(search.delete).toHaveBeenCalledWith("test.searchable", 7);
    });

    it("does nothing for a never-published draft", async () => {
      const { app, search, service } = harness();
      service.delete.mockResolvedValue(draftRow);

      await app.request("/7", { method: "DELETE" });

      expect(search.delete).not.toHaveBeenCalled();
    });
  });

  describe("failure handling", () => {
    it("keeps the mutation successful when the engine throws", async () => {
      const { app, logged, service } = harness({ searchFails: true });
      service.publish.mockResolvedValue({
        changed: true,
        publishedAt: PUBLISHED_AT,
        row: publishedRow,
      });

      const res = await app.request("/7/publish", { method: "POST" });

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({ changed: true });
      expect(logged).toHaveLength(1);
      expect(logged[0]).toContain("[content-search]");
      expect(logged[0]).toContain("test.searchable");
      expect(logged[0]).toContain("engine unavailable");
    });

    it("logs structured context", async () => {
      const { app, logged, service } = harness({ searchFails: true });
      service.delete.mockResolvedValue(publishedRow);

      await app.request("/7", { method: "DELETE" });

      const payload: unknown = JSON.parse(
        logged[0].slice(logged[0].indexOf("{")),
      );

      expect(payload).toMatchObject({
        action: "delete",
        contentTypeId: "test.searchable",
        documentId: "test.searchable:7",
        itemId: 7,
        itemType: "test.searchable",
        operation: "delete",
        pluginId: PLUGIN_ID,
      });
    });

    it("writes no error log when synchronization succeeds", async () => {
      const { app, logged, search, service } = harness();
      service.publish.mockResolvedValue({
        changed: true,
        publishedAt: PUBLISHED_AT,
        row: publishedRow,
      });

      const res = await app.request("/7/publish", { method: "POST" });

      expect(res.status).toBe(200);
      expect(search.index).toHaveBeenCalledTimes(1);
      expect(logged).toEqual([]);
    });

    it("keeps the mutation successful when the logger fails too", async () => {
      // The logger writes to the database, so it can be down for the same reason
      // the search engine is. Both are best effort after a committed write.
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      try {
        const { app, logged, service } = harness({
          logFails: true,
          searchFails: true,
        });
        service.publish.mockResolvedValue({
          changed: true,
          publishedAt: PUBLISHED_AT,
          row: publishedRow,
        });

        const res = await app.request("/7/publish", { method: "POST" });

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toMatchObject({ changed: true });

        // The structured line was attempted, then the console stood in for it -
        // still carrying the original search error, not the logger's.
        expect(logged).toHaveLength(1);
        expect(consoleError).toHaveBeenCalledTimes(1);
        const fallback = String(consoleError.mock.calls[0][0]);
        expect(fallback).toContain("Failed to log content search failure");
        expect(fallback).toContain("engine unavailable");
        expect(fallback).not.toContain("core_logs unavailable");
      } finally {
        consoleError.mockRestore();
      }
    });

    it("does not reach the console when only the engine fails", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      try {
        const { app, service } = harness({ searchFails: true });
        service.delete.mockResolvedValue(publishedRow);

        const res = await app.request("/7", { method: "DELETE" });

        expect(res.status).toBe(200);
        expect(consoleError).not.toHaveBeenCalled();
      } finally {
        consoleError.mockRestore();
      }
    });
  });

  describe("content types without search", () => {
    it("never touches the search engine", async () => {
      const { app, search, service } = harness({ model: plain });
      service.publish.mockResolvedValue({
        changed: true,
        publishedAt: PUBLISHED_AT,
        row: { ...publishedRow, category: 1 },
      });
      service.delete.mockResolvedValue({ ...publishedRow, category: 1 });

      await app.request("/7/publish", { method: "POST" });
      await app.request("/7", { method: "DELETE" });

      expect(search.index).not.toHaveBeenCalled();
      expect(search.delete).not.toHaveBeenCalled();
    });
  });
});
