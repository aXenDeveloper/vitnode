// @vitest-environment node
import type { MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  testLocalizedGuideContentType,
  testLocalizedPageContentType,
} from "@/tests/content-fixtures";

import type * as LanguageResolverModule from "./language-resolver";

import { createContentModel } from "./model";
import { verifyContentPreviewToken } from "./preview-token";
import { buildContentTranslationRoutes } from "./translation-routes";

const SECRET = "a".repeat(48);
const PLUGIN_ID = "@vitnode/example";

const LANGUAGES = [
  { id: 1, isDefault: true, isEnabled: true, locale: "en" },
  { id: 2, isDefault: false, isEnabled: true, locale: "pl" },
];

vi.mock("../../api/lib/check-staff-permission", () => ({
  assertStaffPermission: vi.fn(),
}));

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
// Localized and editorial but with no `publicApi`, so `editorial.preview` cannot
// be enabled on it at all - which is what makes the route conditional.
const guides = createContentModel(testLocalizedGuideContentType);

const translationRow = (overrides: Record<string, unknown> = {}) => ({
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  itemId: 7,
  languageId: 2,
  locale: "pl",
  publishedAt: null,
  status: "draft" as const,
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  values: { body: null, slug: "witaj", title: "Witaj" },
  version: 3,
  ...overrides,
});

const harness = ({ secret = SECRET }: { secret?: string } = {}) => {
  const translations = {
    create: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    // Stage 8 reads the base row's publication state to decide whether a
    // translation's address is publicly reachable. Resolved as "published" so
    // these suites keep exercising what they were written for.
    findBasePublication: vi
      .fn()
      .mockResolvedValue({ publishedAt: new Date(0), status: "published" }),
    findByLanguageId: vi.fn(),
    findByLocale: vi.fn().mockResolvedValue(translationRow()),
    findManyForItem: vi.fn(),
    findManyRowsForItem: vi.fn().mockResolvedValue([]),
    publish: vi.fn(),
    resolveDefaultLanguage: vi.fn(),
    resolveLanguage: vi.fn(),
    unpublish: vi.fn(),
    update: vi.fn(),
  };

  const editorial = {
    create: vi.fn(),
    delete: vi.fn(),
    findRevision: vi.fn(),
    listRevisions: vi.fn().mockResolvedValue({
      edges: [{ id: 915, version: 3 }],
      pageInfo: { endCursor: null, hasNextPage: false },
    }),
    publish: vi.fn(),
    restore: vi.fn(),
    unpublish: vi.fn(),
    update: vi.fn(),
  };

  const shared = {
    revisions: { latest: vi.fn().mockResolvedValue({ id: 812 }) },
  };

  vi.spyOn(pages, "translationService", "get").mockReturnValue(
    () => translations,
  );
  vi.spyOn(pages, "translationEditorialService", "get").mockReturnValue(
    () => editorial,
  );
  vi.spyOn(pages, "editorialService", "get").mockReturnValue(
    () => shared as never,
  );

  const app = new OpenAPIHono();
  const context: MiddlewareHandler = async (c, next) => {
    c.set("admin", { user: { id: 1 } } as never);
    c.set("core", { contentPreviewSecret: secret } as never);
    await next();
  };
  app.use("*", context);

  for (const { handler, route } of buildContentTranslationRoutes(pages, {
    pluginId: PLUGIN_ID,
  })) {
    app.openapi(route, handler);
  }

  return { app, editorial, shared, translations };
};

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.CONTENT_PREVIEW_SECRET = SECRET;
});

describe("route registration", () => {
  it("mints a locale preview only where there is a public API to preview against", () => {
    const paths = buildContentTranslationRoutes(pages, {
      pluginId: PLUGIN_ID,
    }).map(entry => `${entry.route.method.toUpperCase()} ${entry.route.path}`);

    expect(paths).toContain("POST /{id}/translations/{locale}/preview");
    expect(paths).toContain("GET /{id}/public-locales");
  });

  it("builds neither for a localized content type with no public API", () => {
    const paths = buildContentTranslationRoutes(guides, {
      pluginId: PLUGIN_ID,
    }).map(entry => entry.route.path);

    expect(paths).not.toContain("/{id}/translations/{locale}/preview");
    expect(paths).not.toContain("/{id}/public-locales");
  });
});

describe("minting a locale preview link", () => {
  it("freezes both halves of the page", async () => {
    const { app } = harness();

    const body = (await (
      await app.request("/7/translations/pl/preview", { method: "post" })
    ).json()) as { revisionId: number; translationRevisionId: number };

    // A localized page is a record plus a translation. Freezing one would let
    // the other drift under the reviewer.
    expect(body.revisionId).toBe(812);
    expect(body.translationRevisionId).toBe(915);
  });

  it("binds the token to the locale it was minted for", async () => {
    const { app } = harness();

    const body = (await (
      await app.request("/7/translations/pl/preview", { method: "post" })
    ).json()) as { token: string };

    expect(
      verifyContentPreviewToken({
        definition: pages.definition,
        locale: "pl",
        pluginId: PLUGIN_ID,
        secret: SECRET,
        token: body.token,
      }),
    ).toMatchObject({ i: 7, l: "pl", lid: 2, r: 812, tr: 915 });
  });

  it("refuses the same token on another language", async () => {
    const { app } = harness();

    const body = (await (
      await app.request("/7/translations/pl/preview", { method: "post" })
    ).json()) as { token: string };

    // Never falls back: a reviewer sent a Polish link must not be shown English.
    expect(
      verifyContentPreviewToken({
        definition: pages.definition,
        locale: "en",
        pluginId: PLUGIN_ID,
        secret: SECRET,
        token: body.token,
      }),
    ).toBeNull();
  });

  it("carries the locale in the link, so the reader stays bound", async () => {
    const { app } = harness();

    const body = (await (
      await app.request("/7/translations/pl/preview", { method: "post" })
    ).json()) as { url: string };

    expect(new URL(body.url).searchParams.get("locale")).toBe("pl");
  });

  it("404s a locale with no translation rather than linking to the fallback", async () => {
    const { app, translations } = harness();
    translations.findByLocale.mockResolvedValue(null);

    // The button is on a language tab. A link that quietly previewed a
    // different language would be worse than no link.
    const response = await app.request("/7/translations/pl/preview", {
      method: "post",
    });

    expect(response.status).toBe(404);
  });

  it("503s rather than signing with an unusable secret", async () => {
    process.env.CONTENT_PREVIEW_SECRET = "short";
    const { app } = harness({ secret: "short" });

    const response = await app.request("/7/translations/pl/preview", {
      method: "post",
    });

    expect(response.status).toBe(503);
  });

  it("freezes nothing when there is no revision to freeze", async () => {
    const { app, editorial, shared } = harness();
    shared.revisions.latest.mockResolvedValue(null);
    editorial.listRevisions.mockResolvedValue({
      edges: [],
      pageInfo: { endCursor: null, hasNextPage: false },
    });

    const body = (await (
      await app.request("/7/translations/pl/preview", { method: "post" })
    ).json()) as { revisionId: number; translationRevisionId: number };

    // `0` in either slot means "the live row is read for that half", which is
    // the only honest answer when there is nothing recorded to show.
    expect(body).toMatchObject({ revisionId: 0, translationRevisionId: 0 });
  });
});
