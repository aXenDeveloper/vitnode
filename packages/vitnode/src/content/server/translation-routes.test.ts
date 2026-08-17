// @vitest-environment node
import type { MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  testCategoryContentType,
  testLocalizedArticleContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import {
  ContentDefaultTranslationRequired,
  ContentLanguageError,
  ContentTranslationExists,
  ContentTranslationItemMissing,
  ContentTranslationVersionConflict,
} from "../errors";
import { createContentModel } from "./model";
import { buildContentRoutes } from "./routes";
import { buildContentTranslationRoutes } from "./translation-routes";

let permissionGranted = true;
const permissionChecks: { module: string; permission: string }[] = [];
const emitted = vi.fn(() => ({ failures: [], listeners: 0 }));

// `assertStaffPermission` reads roles out of the database. The routes' job is to
// *call* it with the right module and permission, so the check itself is replaced
// with a switchable verdict that records what it was asked.
vi.mock("../../api/lib/check-staff-permission", () => ({
  assertStaffPermission: async (
    _c: unknown,
    args: { module: string; permission: string },
  ) => {
    permissionChecks.push({
      module: args.module,
      permission: args.permission,
    });
    if (!permissionGranted) {
      const { HTTPException } = await import("hono/http-exception");
      throw new HTTPException(403, { message: "Forbidden" });
    }
  },
}));

const localized = createContentModel(testLocalizedArticleContentType);
const categories = createContentModel(testCategoryContentType);
const posts = createContentModel(testPostContentType, {
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

const translationRow = (overrides: Record<string, unknown> = {}) => ({
  createdAt: new Date("2026-01-01T00:00:00Z"),
  itemId: 7,
  languageId: 1,
  locale: "en",
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  values: { body: null, slug: "hello", title: "Hello" },
  version: 1,
  ...overrides,
});

interface Harness {
  app: OpenAPIHono;
  translations: Record<string, ReturnType<typeof vi.fn>>;
}

const harness = ({ allow = true }: { allow?: boolean } = {}): Harness => {
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
    findByLocale: vi.fn(),
    findManyByLanguageId: vi.fn().mockResolvedValue([]),
    findManyForItem: vi.fn(),
    findManyRowsForItem: vi.fn(),
    publish: vi.fn(),
    resolveDefaultLanguage: vi.fn(),
    resolveLanguage: vi.fn(),
    unpublish: vi.fn(),
    update: vi.fn(),
  };

  permissionGranted = allow;
  permissionChecks.length = 0;
  vi.spyOn(localized, "translationService", "get").mockReturnValue(
    () => translations,
  );

  const app = new OpenAPIHono();

  const context: MiddlewareHandler = async (c, next) => {
    c.set("admin", allow ? { user: adminUser } : null);
    // Every write route announces itself after the commit. The transport is not
    // what these tests are about, so it records instead of delivering - and a
    // missing one would surface as a 500 rather than as a missing event.
    c.set("events", { emit: emitted } as never);
    await next();
  };
  app.use("*", context);

  for (const { handler, route } of buildContentTranslationRoutes(localized, {
    pluginId: PLUGIN_ID,
  })) {
    app.openapi(route, handler);
  }

  return { app, translations };
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("route registration", () => {
  it("appends the translation routes to a localized content type", () => {
    const paths = buildContentRoutes(localized, { pluginId: PLUGIN_ID }).map(
      entry => `${entry.route.method.toUpperCase()} ${entry.route.path}`,
    );

    expect(paths).toEqual(
      expect.arrayContaining([
        "GET /{id}/translations",
        "GET /{id}/translations/{locale}",
        "POST /{id}/translations/{locale}",
        "PUT /{id}/translations/{locale}",
        "DELETE /{id}/translations/{locale}",
      ]),
    );
  });

  it("generates none of them for a content type without localization", () => {
    const paths = buildContentRoutes(posts, { pluginId: PLUGIN_ID }).map(
      entry => entry.route.path,
    );

    expect(paths.some(path => path.includes("translations"))).toBe(false);
  });

  it("refuses to build them for a content type without localization", () => {
    expect(() =>
      buildContentTranslationRoutes(posts, { pluginId: PLUGIN_ID }),
    ).toThrow(/needs a localized content type/);
  });
});

describe("GET /{id}/translations", () => {
  it("returns every locale with its values, in one read", async () => {
    const { app, translations } = harness();
    translations.findManyRowsForItem.mockResolvedValue([
      translationRow(),
      translationRow({ languageId: 2, locale: "pl", version: 3 }),
    ]);

    const response = await app.request("/7/translations");

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      edges: {
        locale: string;
        values: Record<string, unknown>;
        version: number;
      }[];
    };
    expect(body.edges.map(edge => edge.locale)).toEqual(["en", "pl"]);
    // The AdminCP form opens on every language at once, so the values come with
    // the metadata rather than one request per language behind them.
    expect(body.edges[0].values).toBeDefined();
    // One query for the whole set - never one per locale.
    expect(translations.findManyRowsForItem).toHaveBeenCalledTimes(1);
    expect(translations.findByLocale).not.toHaveBeenCalled();
  });

  it("needs `can_view`", async () => {
    const { app, translations } = harness();
    translations.findManyRowsForItem.mockResolvedValue([]);

    await app.request("/7/translations");

    expect(permissionChecks).toEqual([
      { module: "localized", permission: "can_view" },
    ]);
  });

  it("is 403 without the permission", async () => {
    const { app } = harness({ allow: false });

    expect((await app.request("/7/translations")).status).toBe(403);
  });

  it("rejects a non-numeric identifier", async () => {
    const { app } = harness();

    expect((await app.request("/abc/translations")).status).toBe(400);
  });
});

describe("GET /{id}/translations/{locale}", () => {
  it("returns one translation with its values", async () => {
    const { app, translations } = harness();
    translations.findByLocale.mockResolvedValue(translationRow());

    const response = await app.request("/7/translations/en");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      itemId: 7,
      languageId: 1,
      locale: "en",
      values: { slug: "hello", title: "Hello" },
      version: 1,
    });
  });

  it("is 404 when there is no translation in that locale", async () => {
    const { app, translations } = harness();
    translations.findByLocale.mockResolvedValue(null);

    expect((await app.request("/7/translations/de")).status).toBe(404);
  });

  it("passes the locale through untouched, casing included", async () => {
    const { app, translations } = harness();
    translations.findByLocale.mockResolvedValue(translationRow());

    await app.request("/7/translations/PL");

    // The resolver owns normalisation; the route does not pre-empt it.
    expect(translations.findByLocale).toHaveBeenCalledWith(7, "PL");
  });

  it("rejects a locale wider than core_languages.code", async () => {
    const { app } = harness();

    expect(
      (await app.request(`/7/translations/${"x".repeat(33)}`)).status,
    ).toBe(400);
  });
});

describe("POST /{id}/translations/{locale}", () => {
  const post = async (app: OpenAPIHono, body: unknown, locale = "pl") =>
    app.request(`/7/translations/${locale}`, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

  it("creates a translation and answers 201", async () => {
    const { app, translations } = harness();
    translations.create.mockResolvedValue(
      translationRow({ languageId: 2, locale: "pl" }),
    );

    const response = await post(app, { values: { title: "Witaj" } });

    expect(response.status).toBe(201);
    expect(translations.create).toHaveBeenCalledWith(7, "pl", {
      title: "Witaj",
    });
  });

  it("needs `can_edit`, and no permission of its own", async () => {
    const { app, translations } = harness();
    translations.create.mockResolvedValue(translationRow());

    await post(app, { values: { title: "Witaj" } });

    expect(permissionChecks).toEqual([
      { module: "localized", permission: "can_edit" },
    ]);
  });

  it("rejects values outside the envelope", async () => {
    const { app } = harness();

    // `expectedVersion`, `locale` and `itemId` are transport, so they can never
    // be part of a strict `values` object.
    expect((await post(app, { title: "Witaj" })).status).toBe(400);
    expect(
      (await post(app, { values: { itemId: 9, title: "Witaj" } })).status,
    ).toBe(400);
  });

  it("answers 404 for a record that is not there", async () => {
    const { app, translations } = harness();
    translations.create.mockRejectedValue(
      new ContentTranslationItemMissing({
        contentTypeId: "test.localized",
        itemId: 7,
      }),
    );

    expect((await post(app, { values: { title: "Witaj" } })).status).toBe(404);
  });

  it("answers 404 for an unknown locale", async () => {
    const { app, translations } = harness();
    translations.create.mockRejectedValue(
      new ContentLanguageError({ locale: "de", reason: "missing" }),
    );

    expect((await post(app, { values: { title: "Hallo" } }, "de")).status).toBe(
      404,
    );
  });

  it("answers a structured 409 for a disabled locale", async () => {
    const { app, translations } = harness();
    translations.create.mockRejectedValue(
      new ContentLanguageError({ locale: "pl", reason: "disabled" }),
    );

    const response = await post(app, { values: { title: "Witaj" } });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: "CONTENT_LANGUAGE_DISABLED",
      contentTypeId: "test.localized",
      locale: "pl",
    });
  });

  it("answers a structured 409 when the locale already has one", async () => {
    const { app, translations } = harness();
    translations.create.mockRejectedValue(
      new ContentTranslationExists({
        contentTypeId: "test.localized",
        itemId: 7,
        locale: "pl",
      }),
    );

    const response = await post(app, { values: { title: "Witaj" } });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: "CONTENT_TRANSLATION_EXISTS",
      contentTypeId: "test.localized",
      itemId: 7,
      locale: "pl",
    });
  });

  it("answers a structured 409 when a localized slug is taken", async () => {
    const { app, translations } = harness();
    translations.create.mockRejectedValue(
      Object.assign(new Error("duplicate key"), { code: "23505" }),
    );

    const response = await post(app, { values: { title: "Witaj" } });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: "CONTENT_TRANSLATION_UNIQUE_CONFLICT",
      contentTypeId: "test.localized",
      itemId: 7,
      locale: "pl",
    });
  });

  it("never leaks the driver's message", async () => {
    const { app, translations } = harness();
    translations.create.mockRejectedValue(
      Object.assign(
        new Error(
          'duplicate key value violates unique constraint "test_localized_articles_translations_language_id_slug_key"',
        ),
        { code: "23505" },
      ),
    );

    const body = await (await post(app, { values: { title: "Witaj" } })).text();

    expect(body).not.toContain("unique constraint");
  });
});

describe("PUT /{id}/translations/{locale}", () => {
  const put = async (app: OpenAPIHono, body: unknown, locale = "en") =>
    app.request(`/7/translations/${locale}`, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });

  it("updates one locale and reports the new version", async () => {
    const { app, translations } = harness();
    translations.update.mockResolvedValue({
      changed: true,
      changedFields: ["title"],
      row: translationRow({ version: 4 }),
      version: 4,
    });

    const response = await put(app, {
      expectedVersion: 3,
      values: { title: "New" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      changed: true,
      row: { version: 4 },
    });
    expect(translations.update).toHaveBeenCalledWith(
      7,
      "en",
      { title: "New" },
      { expectedVersion: 3 },
    );
  });

  it("reports a no-op as changed: false", async () => {
    const { app, translations } = harness();
    translations.update.mockResolvedValue({
      changed: false,
      changedFields: [],
      row: translationRow({ version: 3 }),
      version: 3,
    });

    const response = await put(app, {
      expectedVersion: 3,
      values: { title: "Hello" },
    });

    expect(await response.json()).toMatchObject({
      changed: false,
      row: { version: 3 },
    });
  });

  it("requires an expected version", async () => {
    const { app } = harness();

    expect((await put(app, { values: { title: "New" } })).status).toBe(400);
  });

  it("rejects an empty patch", async () => {
    const { app } = harness();

    expect((await put(app, { expectedVersion: 1, values: {} })).status).toBe(
      400,
    );
  });

  it("answers a structured 409 naming the locale that moved", async () => {
    const { app, translations } = harness();
    translations.update.mockRejectedValue(
      new ContentTranslationVersionConflict({
        contentTypeId: "test.localized",
        currentVersion: 5,
        expectedVersion: 3,
        itemId: 7,
        locale: "en",
      }),
    );

    const response = await put(app, {
      expectedVersion: 3,
      values: { title: "New" },
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: "CONTENT_TRANSLATION_VERSION_CONFLICT",
      contentTypeId: "test.localized",
      currentVersion: 5,
      expectedVersion: 3,
      itemId: 7,
      // The tab that has to be reloaded, and only that one.
      locale: "en",
    });
  });

  it("is 404 when the translation is missing", async () => {
    const { app, translations } = harness();
    translations.update.mockResolvedValue(null);

    expect(
      (await put(app, { expectedVersion: 1, values: { title: "New" } })).status,
    ).toBe(404);
  });
});

describe("DELETE /{id}/translations/{locale}", () => {
  const remove = async (app: OpenAPIHono, body: unknown, locale = "pl") =>
    app.request(`/7/translations/${locale}`, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "DELETE",
    });

  it("deletes a non-default translation", async () => {
    const { app, translations } = harness();
    translations.delete.mockResolvedValue(
      translationRow({ languageId: 2, locale: "pl", version: 2 }),
    );

    const response = await remove(app, { expectedVersion: 2 });

    expect(response.status).toBe(200);
    expect(translations.delete).toHaveBeenCalledWith(7, "pl", {
      expectedVersion: 2,
    });
  });

  it("needs `can_delete`", async () => {
    const { app, translations } = harness();
    translations.delete.mockResolvedValue(translationRow());

    await remove(app, { expectedVersion: 1 });

    expect(permissionChecks).toEqual([
      { module: "localized", permission: "can_delete" },
    ]);
  });

  it("requires an expected version", async () => {
    const { app } = harness();

    expect((await remove(app, {})).status).toBe(400);
  });

  it("refuses the default translation with a structured 409", async () => {
    const { app, translations } = harness();
    translations.delete.mockRejectedValue(
      new ContentDefaultTranslationRequired({
        contentTypeId: "test.localized",
        itemId: 7,
        locale: "en",
      }),
    );

    const response = await remove(app, { expectedVersion: 1 }, "en");

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: "CONTENT_DEFAULT_TRANSLATION_REQUIRED",
      contentTypeId: "test.localized",
      itemId: 7,
      locale: "en",
    });
  });

  it("is 404 when the translation is already gone", async () => {
    const { app, translations } = harness();
    translations.delete.mockResolvedValue(null);

    expect((await remove(app, { expectedVersion: 1 })).status).toBe(404);
  });
});

describe("the OpenAPI document", () => {
  it("describes every translation route and its 409 union", () => {
    const { app } = harness();
    const document = app.getOpenAPI31Document({
      info: { title: "test", version: "1" },
      openapi: "3.1.0",
    });

    const detail = document.paths?.["/{id}/translations/{locale}"];

    expect(Object.keys(detail ?? {}).sort()).toEqual([
      "delete",
      "get",
      "post",
      "put",
    ]);
    expect(detail?.put?.responses?.["409"]).toBeDefined();
    // The list route is metadata-only, so it has no 409 at all.
    expect(
      document.paths?.["/{id}/translations"]?.get?.responses?.["409"],
    ).toBeUndefined();
  });
});
