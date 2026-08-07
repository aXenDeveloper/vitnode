// @vitest-environment node
import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { testLocalizedPageContentType } from "@/tests/content-fixtures";

import type * as LanguageResolverModule from "./language-resolver";

import { createContentModel } from "./model";
import { buildContentPublicRoutes } from "./public-routes";

const LANGUAGES = [
  { id: 1, isDefault: true, isEnabled: true, locale: "en" },
  { id: 2, isDefault: false, isEnabled: true, locale: "pl" },
  // Present in `core_languages` but switched off in this app's config. Readable
  // in the AdminCP, unreachable in public - the read-side half of the rule that
  // already stops content being written into one.
  { id: 3, isDefault: false, isEnabled: false, locale: "de" },
];

vi.mock("./language-resolver", async importOriginal => {
  const actual = await importOriginal<typeof LanguageResolverModule>();

  return {
    ...actual,
    findContentLanguage: vi.fn(async (_c: unknown, locale: string) =>
      Promise.resolve(
        LANGUAGES.find(
          language => language.locale.toLowerCase() === locale.toLowerCase(),
        ) ?? null,
      ),
    ),
    listContentLanguages: vi.fn(async () => Promise.resolve(LANGUAGES)),
  };
});

const pages = createContentModel(testLocalizedPageContentType);
const PLUGIN_ID = "@vitnode/example";

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

const row = {
  body: "Cześć",
  featured: false,
  locale: "pl",
  publishedAt: new Date("2026-01-01T00:00:00.000Z"),
  slug: "witaj",
  title: "Witaj",
};

const harness = () => {
  const service = {
    findById: vi.fn(),
    findBySlug: vi.fn(),
    findMany: vi.fn().mockResolvedValue(emptyPage),
  };

  vi.spyOn(pages, "publicService", "get").mockReturnValue(() => service);

  const app = new OpenAPIHono();
  for (const { handler, route } of buildContentPublicRoutes(pages, {
    pluginId: PLUGIN_ID,
  })) {
    app.openapi(route, handler);
  }

  return { app, service };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("locale precedence on a public route", () => {
  it("uses the content type's default locale with no signal at all", async () => {
    const { app, service } = harness();

    await app.request("/");

    expect(service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "en" }),
    );
  });

  it("prefers an explicit `?locale=` over `Accept-Language`", async () => {
    const { app, service } = harness();

    await app.request("/?locale=pl", {
      headers: { "accept-language": "en" },
    });

    expect(service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "pl" }),
    );
  });

  it("negotiates from `Accept-Language` when no locale is given", async () => {
    const { app, service } = harness();

    await app.request("/", {
      headers: { "accept-language": "pl;q=0.9, en;q=0.2" },
    });

    expect(service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "pl" }),
    );
  });

  it("returns the canonical spelling, not the caller's", async () => {
    const { app, service } = harness();

    await app.request("/?locale=PL");

    expect(service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "pl" }),
    );
  });

  it("404s an explicit locale this install does not serve", async () => {
    const { app, service } = harness();

    // Not an empty list, and not a silent substitution: an empty list would say
    // "this language has no pages", which is a different and untrue thing.
    expect((await app.request("/?locale=fr")).status).toBe(404);
    expect(service.findMany).not.toHaveBeenCalled();
  });

  it("404s an explicit locale the app has switched off", async () => {
    const { app } = harness();

    expect((await app.request("/?locale=de")).status).toBe(404);
  });

  it("404s a locale-shaped attack rather than passing it down", async () => {
    const { app, service } = harness();

    expect((await app.request("/?locale=..%2F..%2Fetc")).status).toBe(404);
    expect(service.findMany).not.toHaveBeenCalled();
  });

  it("ignores a disabled language while negotiating", async () => {
    const { app, service } = harness();

    await app.request("/", { headers: { "accept-language": "de" } });

    expect(service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "en" }),
    );
  });
});

describe("locale headers", () => {
  it("states the language it answered in", async () => {
    const { app, service } = harness();
    service.findBySlug.mockResolvedValue(row);

    const response = await app.request("/witaj?locale=pl");

    expect(response.headers.get("Content-Language")).toBe("pl");
  });

  it("varies on `Accept-Language` only when the header decided", async () => {
    const { app } = harness();

    const negotiated = await app.request("/", {
      headers: { "accept-language": "pl" },
    });
    const explicit = await app.request("/?locale=pl");

    expect(negotiated.headers.get("Vary")).toBe("Accept-Language");
    // Keyed by its URL, so varying on a header that decided nothing would
    // fragment every shared cache for free.
    expect(explicit.headers.get("Vary")).toBeNull();
  });
});

describe("locale-aware detail route", () => {
  it("passes the resolved locale to the strict-locale lookup", async () => {
    const { app, service } = harness();
    service.findBySlug.mockResolvedValue(row);

    await app.request("/witaj?locale=pl");

    expect(service.findBySlug).toHaveBeenCalledWith("witaj", { locale: "pl" });
  });

  it("404s a slug that has no translation in this language", async () => {
    const { app, service } = harness();
    service.findBySlug.mockResolvedValue(null);

    // The service is strict-locale, so this is what "never falls back" looks
    // like from the outside: the same 404 as a typo.
    expect((await app.request("/witaj?locale=en")).status).toBe(404);
  });

  it("returns the language the row is actually in", async () => {
    const { app, service } = harness();
    // A fallback: asked for Polish, served the English translation.
    service.findBySlug.mockResolvedValue({ ...row, locale: "en" });

    const body = (await (await app.request("/hello?locale=pl")).json()) as {
      locale: string;
    };

    expect(body.locale).toBe("en");
  });
});

describe("localized public schema", () => {
  it("declares `locale` on the response", () => {
    expect(pages.schemas.publicSelectObject.shape).toHaveProperty("locale");
  });

  it("still declares only the allowlisted fields besides it", () => {
    expect(Object.keys(pages.schemas.publicSelectObject.shape).sort()).toEqual([
      "body",
      "featured",
      "locale",
      "publishedAt",
      "slug",
      "title",
    ]);
  });
});
