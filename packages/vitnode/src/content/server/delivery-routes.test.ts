// @vitest-environment node
import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it, vi } from "vitest";

import {
  testDeliveredPostContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import { createContentModel } from "./model";
import { buildContentPublicRoutes } from "./public-routes";

const delivered = createContentModel(testDeliveredPostContentType);

const PLUGIN_ID = "@vitnode/example";

const metadata = {
  alternates: [],
  canonicalPath: "/delivered-posts/hello-world",
  hreflang: { languages: {} },
  isFallback: false,
  itemId: 42,
  locale: null,
  openGraph: { description: "Prose", title: "Hello world" },
  requestedLocale: null,
  robots: { follow: true, index: true },
  seo: { description: "Prose", title: "Hello world" },
};

const harness = () => {
  const service = {
    alternates: vi.fn(),
    findById: vi.fn(),
    history: vi.fn(),
    resolvePath: vi.fn(),
    resolveSlug: vi.fn(),
    sitemap: vi.fn(),
  };

  vi.spyOn(delivered, "deliveryService", "get").mockReturnValue(() => service);
  // The public service is never reached by a delivery route - the delivery service
  // is - but the route builder still asks the model for it.
  vi.spyOn(delivered, "publicService", "get").mockReturnValue(() => ({
    findById: vi.fn(),
    findBySlug: vi.fn(),
    findMany: vi.fn(),
  }));

  const app = new OpenAPIHono();
  for (const { handler, route } of buildContentPublicRoutes(delivered, {
    pluginId: PLUGIN_ID,
  })) {
    app.openapi(route, handler);
  }

  return { app, service };
};

describe("route generation", () => {
  it("adds three delivery routes under a static `delivery` segment", () => {
    const paths = buildContentPublicRoutes(delivered, {
      pluginId: PLUGIN_ID,
    }).map(entry => entry.route.path);

    expect(paths).toContain("/delivery/resolve/{slug}");
    expect(paths).toContain("/delivery/item/{id}");
    expect(paths).toContain("/delivery/sitemap");
  });

  it("adds none at all to a content type without delivery", () => {
    const posts = createContentModel(testPostContentType, {
      references: { category: () => delivered.table.id },
    });

    const paths = buildContentPublicRoutes(posts, { pluginId: PLUGIN_ID }).map(
      entry => entry.route.path,
    );

    // The Stage 1-7 path list, unchanged.
    expect(paths).toStrictEqual(["/", "/{slug}"]);
  });

  it("cannot be shadowed by a record whose slug is `delivery`", () => {
    // `/{slug}` is one segment and every delivery path is two or three, so the two
    // can never both match whatever order they are registered in.
    const paths = buildContentPublicRoutes(delivered, {
      pluginId: PLUGIN_ID,
    }).map(entry => entry.route.path);

    expect(paths.filter(path => path === "/{slug}")).toHaveLength(1);
    expect(paths.every(path => path.split("/").length <= 4)).toBe(true);
  });
});

describe("resolve route", () => {
  it("answers without any session at all", async () => {
    const { app, service } = harness();
    service.resolveSlug.mockResolvedValue({ ...metadata, type: "content" });

    const response = await app.request("/delivery/resolve/hello-world");

    expect(response.status).toBe(200);
  });

  it("returns the canonical arm for a current slug", async () => {
    const { app, service } = harness();
    service.resolveSlug.mockResolvedValue({ ...metadata, type: "content" });

    const response = await app.request("/delivery/resolve/hello-world");

    expect(await response.json()).toMatchObject({
      canonicalPath: "/delivered-posts/hello-world",
      itemId: 42,
      type: "content",
    });
  });

  it("returns the redirect arm with its status in the body", async () => {
    const { app, service } = harness();
    service.resolveSlug.mockResolvedValue({
      location: "/delivered-posts/new",
      status: 308,
      type: "redirect",
    });

    const response = await app.request("/delivery/resolve/old");

    // A 200 carrying a redirect, not an HTTP redirect: the *frontend* issues the
    // 308, because it owns the URL the reader is on.
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({
      location: "/delivered-posts/new",
      status: 308,
      type: "redirect",
    });
  });

  it("returns the not_found arm as a 200 with a body", async () => {
    const { app, service } = harness();
    service.resolveSlug.mockResolvedValue({ type: "not_found" });

    const response = await app.request("/delivery/resolve/nope");

    // A 200, so a caller distinguishes "this URL resolves to nothing" from "the
    // delivery API is unreachable" - and so a negative is not cached as a 404.
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({ type: "not_found" });
  });

  it("exposes no internal storage fields", async () => {
    const { app, service } = harness();
    service.resolveSlug.mockResolvedValue({ ...metadata, type: "content" });

    const body = (await (
      await app.request("/delivery/resolve/hello-world")
    ).json()) as Record<string, unknown>;

    for (const internal of ["languageId", "pluginId", "retiredAt"]) {
      expect(body).not.toHaveProperty(internal);
    }
  });
});

describe("item route", () => {
  it("returns the delivery metadata of one record", async () => {
    const { app, service } = harness();
    service.findById.mockResolvedValue(metadata);

    const response = await app.request("/delivery/item/42");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      canonicalPath: "/delivered-posts/hello-world",
      seo: { description: "Prose", title: "Hello world" },
    });
    expect(service.findById).toHaveBeenCalledWith(42, { locale: undefined });
  });

  it("is a 404 for a record with no public version", async () => {
    const { app, service } = harness();
    service.findById.mockResolvedValue(null);

    expect((await app.request("/delivery/item/42")).status).toBe(404);
  });

  it("rejects a non-numeric identifier at validation time", async () => {
    const { app } = harness();

    expect((await app.request("/delivery/item/abc")).status).toBe(400);
  });
});

describe("sitemap route", () => {
  it("serializes lastModified as an ISO string, matching its schema", async () => {
    const { app, service } = harness();
    service.sitemap.mockResolvedValue({
      entries: [
        {
          changeFrequency: "weekly",
          itemId: 42,
          lastModified: new Date("2026-01-02T03:04:05.000Z"),
          locale: null,
          path: "/delivered-posts/hello-world",
          priority: 0.7,
        },
      ],
      nextCursor: null,
    });

    const response = await app.request("/delivery/sitemap");

    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({
      entries: [
        {
          changeFrequency: "weekly",
          itemId: 42,
          lastModified: "2026-01-02T03:04:05.000Z",
          locale: null,
          path: "/delivered-posts/hello-world",
          priority: 0.7,
        },
      ],
      nextCursor: null,
    });
  });

  it("passes the cursor and limit through", async () => {
    const { app, service } = harness();
    service.sitemap.mockResolvedValue({ entries: [], nextCursor: null });

    await app.request("/delivery/sitemap?cursor=99&limit=10");

    expect(service.sitemap).toHaveBeenCalledWith({
      cursor: 99,
      limit: 10,
      locale: undefined,
    });
  });

  it("rejects a limit above the protocol ceiling", async () => {
    const { app } = harness();

    expect((await app.request("/delivery/sitemap?limit=50001")).status).toBe(
      400,
    );
  });
});
