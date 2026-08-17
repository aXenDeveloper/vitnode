// @vitest-environment node
import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  testDeliveredPostContentType,
  testEditorialPostContentType,
} from "@/tests/content-fixtures";

import { createContentModel } from "./model";
import { buildContentRoutes } from "./routes";

let permissionGranted = true;
let requestedPermission: null | { module: string; permission: string } = null;

// `assertStaffPermission` reads roles out of the database. What matters here is that
// the route *asks* for `can_view` and nothing narrower, so the check itself is
// replaced with a recorder plus a switchable verdict.
vi.mock("../../api/lib/check-staff-permission", () => ({
  assertStaffPermission: async (
    _c: unknown,
    args: { module: string; permission: string },
  ) => {
    requestedPermission = { module: args.module, permission: args.permission };
    if (!permissionGranted) {
      const { HTTPException } = await import("hono/http-exception");
      throw new HTTPException(403, { message: "Forbidden" });
    }
  },
}));

const delivered = createContentModel(testDeliveredPostContentType);
const editorialPosts = createContentModel(testEditorialPostContentType);

const PLUGIN_ID = "@vitnode/example";

const harness = () => {
  const service = {
    alternates: vi.fn(),
    findById: vi.fn(),
    history: vi.fn().mockResolvedValue([]),
    resolvePath: vi.fn(),
    resolveSlug: vi.fn(),
    sitemap: vi.fn(),
  };

  vi.spyOn(delivered, "deliveryService", "get").mockReturnValue(() => service);

  const app = new OpenAPIHono();
  for (const { handler, route } of buildContentRoutes(delivered, {
    pluginId: PLUGIN_ID,
  })) {
    app.openapi(route, handler);
  }

  return { app, service };
};

beforeEach(() => {
  permissionGranted = true;
  requestedPermission = null;
});

describe("route generation", () => {
  it("adds the delivery route only for a delivery-enabled content type", () => {
    const withDelivery = buildContentRoutes(delivered, {
      pluginId: PLUGIN_ID,
    }).map(entry => entry.route.path);
    const without = buildContentRoutes(editorialPosts, {
      pluginId: PLUGIN_ID,
    }).map(entry => entry.route.path);

    expect(withDelivery).toContain("/{id}/delivery");
    expect(without).not.toContain("/{id}/delivery");
  });
});

describe("admin delivery route", () => {
  it("is gated by can_view rather than a permission of its own", async () => {
    const { app } = harness();

    await app.request("/42/delivery");

    // Read-only, so the permission that allowed the slug mutation is the only one it
    // needs. A `can_manage_redirects` would be a permission every install has to
    // configure for no decision this screen can make.
    expect(requestedPermission).toStrictEqual({
      module: testDeliveredPostContentType.permissionModule,
      permission: "can_view",
    });
  });

  it("refuses a request without the permission", async () => {
    permissionGranted = false;
    const { app } = harness();

    expect((await app.request("/42/delivery")).status).toBe(403);
  });

  it("reports the canonical URL and the historical ones", async () => {
    const { app, service } = harness();
    service.findById.mockResolvedValue({
      canonicalPath: "/delivered-posts/current",
      locale: null,
    });
    service.history.mockResolvedValue([
      {
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        itemId: 42,
        languageId: null,
        path: "/delivered-posts/current",
        retiredAt: null,
        slug: "current",
      },
      {
        createdAt: new Date("2025-12-01T00:00:00.000Z"),
        itemId: 42,
        languageId: null,
        path: "/delivered-posts/old",
        retiredAt: new Date("2026-01-01T00:00:00.000Z"),
        slug: "old",
      },
    ]);

    const response = await app.request("/42/delivery");
    const body = (await response.json()) as {
      canonicalPath: string;
      history: Record<string, unknown>[];
      isPublic: boolean;
    };

    expect(response.status).toBe(200);
    expect(body.canonicalPath).toBe("/delivered-posts/current");
    expect(body.isPublic).toBe(true);
    expect(body.history).toHaveLength(2);
  });

  it("exposes no storage columns of the history table", async () => {
    const { app, service } = harness();
    service.findById.mockResolvedValue({
      canonicalPath: "/delivered-posts/current",
      locale: null,
    });
    service.history.mockResolvedValue([
      {
        createdAt: new Date(0),
        itemId: 42,
        languageId: 2,
        path: "/delivered-posts/old",
        retiredAt: new Date(0),
        slug: "old",
      },
    ]);

    const body = (await (await app.request("/42/delivery")).json()) as {
      history: Record<string, unknown>[];
    };

    // `languageId`, `pluginId` and the row id are details of
    // `core_content_slug_history`, not part of this contract.
    expect(Object.keys(body.history[0]).sort()).toStrictEqual([
      "createdAt",
      "path",
      "retiredAt",
      "slug",
    ]);
  });

  it("reports a draft as having no canonical URL rather than inventing one", async () => {
    const { app, service } = harness();
    service.findById.mockResolvedValue(null);

    const body = (await (await app.request("/42/delivery")).json()) as {
      canonicalPath: null | string;
      isPublic: boolean;
    };

    // "This is where it *would* live" is a different claim from "this is where it
    // lives", and the panel must not make the first one look like the second.
    expect(body.canonicalPath).toBeNull();
    expect(body.isPublic).toBe(false);
  });

  it("scopes the read to one language when asked", async () => {
    const { app, service } = harness();
    service.findById.mockResolvedValue({ canonicalPath: null, locale: "pl" });

    await app.request("/42/delivery?locale=pl");

    expect(service.findById).toHaveBeenCalledWith(42, { locale: "pl" });
    expect(service.history).toHaveBeenCalledWith(42, { locale: "pl" });
  });

  it("rejects an invalid identifier", async () => {
    const { app } = harness();

    expect((await app.request("/abc/delivery")).status).toBe(400);
  });
});
