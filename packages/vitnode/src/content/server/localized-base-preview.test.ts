// @vitest-environment node
import { OpenAPIHono } from "@hono/zod-openapi";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { testDeliveredPreviewableContentType } from "@/tests/content-fixtures";

import { createContentModel } from "./model";
import { buildContentPublicRoutes } from "./public-routes";
import { buildContentRoutes } from "./routes";

// `assertStaffPermission` reads roles out of the database. Whether the preview
// route is permission-gated is asserted elsewhere; here it is in the way.
vi.mock("../../api/lib/check-staff-permission", () => ({
  assertStaffPermission: async () => Promise.resolve(),
}));

const PLUGIN_ID = "@vitnode/example";
const SECRET = "unit-test-content-preview-secret-0123456789";

const posts = createContentModel(testDeliveredPreviewableContentType);

const mintHarness = () => {
  const service = { findById: vi.fn() };
  const revisions = {
    latest: vi.fn().mockResolvedValue({ id: 42, version: 5 }),
  };
  const findByLocale = vi.fn();
  const listRevisions = vi.fn().mockResolvedValue({ edges: [{ id: 99 }] });

  vi.spyOn(posts, "service").mockReturnValue(service as never);
  vi.spyOn(posts, "editorialService", "get").mockReturnValue(
    () => ({ revisions }) as never,
  );
  vi.spyOn(posts, "translationService", "get").mockReturnValue(
    () => ({ findByLocale }) as never,
  );
  vi.spyOn(posts, "translationEditorialService", "get").mockReturnValue(
    () => ({ listRevisions }) as never,
  );

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("admin", { user: { id: 1 } } as never);
    c.set("core", { contentPreviewSecret: SECRET } as never);
    c.set("user", null);
    await next();
  });
  for (const { handler, route } of buildContentRoutes(posts, {
    pluginId: PLUGIN_ID,
  })) {
    app.openapi(route, handler);
  }

  return { app, findByLocale, listRevisions, service };
};

/** The public side, so a minted link can be followed rather than just inspected. */
const readHarness = () => {
  const findById = vi.fn();
  const findRevision = vi.fn();

  vi.spyOn(posts, "editorialService", "get").mockReturnValue(
    () => ({ revisions: { findById } }) as never,
  );
  // The token freezes both halves, so the reader asks for the translation
  // revision too - `tr` is what the mint route just put in it.
  vi.spyOn(posts, "translationEditorialService", "get").mockReturnValue(
    () => ({ findRevision }) as never,
  );

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("db", {
      select: () => ({
        from: async () =>
          Promise.resolve([{ code: "en", id: 1, default: true }]),
      }),
    } as never);
    c.set("core", { contentPreviewSecret: SECRET } as never);
    await next();
  });
  for (const { handler, route } of buildContentPublicRoutes(posts, {
    pluginId: PLUGIN_ID,
  })) {
    app.openapi(route, handler);
  }

  return { app, findById, findRevision };
};

const payloadOf = (token: string): Record<string, unknown> =>
  JSON.parse(
    Buffer.from(token.split(".")[0] ?? "", "base64url").toString("utf8"),
  ) as Record<string, unknown>;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_WEB_URL", "https://example.com");
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("the base preview mint on a localized content type", () => {
  const article = { id: 7, publishedAt: null, status: "draft", version: 5 };

  it("links at the record's page in the web app, not the JSON endpoint", async () => {
    const { app, findByLocale, service } = mintHarness();
    service.findById.mockResolvedValue(article);
    findByLocale.mockResolvedValue({
      languageId: 1,
      locale: "en",
      values: { slug: "hello-world", title: "Hello world" },
      version: 5,
    });

    const body = (await (
      await app.request("/7/preview", { method: "POST" })
    ).json()) as { token: string; url: string };

    const url = new URL(body.url);
    expect(url.origin).toBe("https://example.com");
    expect(url.pathname).toBe("/en/delivered-previewable/hello-world");
    expect(url.searchParams.get("preview")).toBe(body.token);
  });

  it("binds the token to the default locale", async () => {
    // Without this the link 404s wherever it points: the public preview route
    // resolves a locale for every localized read and refuses a token that names
    // a different one - and a locale-less token names none.
    const { app, findByLocale, service } = mintHarness();
    service.findById.mockResolvedValue(article);
    findByLocale.mockResolvedValue({
      languageId: 1,
      locale: "en",
      values: { slug: "hello-world" },
      version: 5,
    });

    const { token } = (await (
      await app.request("/7/preview", { method: "POST" })
    ).json()) as { token: string };

    expect(payloadOf(token)).toMatchObject({ l: "en", lid: 1, tr: 99 });
    expect(findByLocale).toHaveBeenCalledWith(7, "en");
  });

  it("mints a link the public route actually honours", async () => {
    // The round trip, because the two halves agreeing is the whole fix.
    const mint = mintHarness();
    mint.service.findById.mockResolvedValue(article);
    mint.findByLocale.mockResolvedValue({
      languageId: 1,
      locale: "en",
      values: { slug: "hello-world" },
      version: 5,
    });

    const { token } = (await (
      await mint.app.request("/7/preview", { method: "POST" })
    ).json()) as { token: string };

    vi.restoreAllMocks();
    const read = readHarness();
    read.findById.mockResolvedValue({
      snapshot: {
        contentTypeId: testDeliveredPreviewableContentType.id,
        createdAt: "2026-08-01T09:00:00.000Z",
        fields: { publishedAt: null },
        id: 42,
        publication: { publishedAt: null, status: "draft" },
        schemaVersion: 1,
        updatedAt: "2026-08-02T09:00:00.000Z",
        version: 5,
      },
    });
    read.findRevision.mockResolvedValue({
      snapshot: {
        fields: { slug: "hello-world", title: "Hello world" },
      },
    });

    const res = await read.app.request(
      `/preview/${encodeURIComponent(token)}?locale=en`,
    );

    expect(res.status).toBe(200);
  });

  it("falls back to the endpoint when the record has no translation yet", async () => {
    // Nothing to name a language or a slug with, so there is no page to link at.
    const { app, findByLocale, service } = mintHarness();
    service.findById.mockResolvedValue(article);
    findByLocale.mockResolvedValue(null);

    const body = (await (
      await app.request("/7/preview", { method: "POST" })
    ).json()) as { url: string };

    expect(new URL(body.url).origin).toBe("https://api.example.com");
  });
});
