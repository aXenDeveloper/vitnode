// @vitest-environment node
import type { MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { testStrictLocalizedPageContentType } from "@/tests/content-fixtures";

import { createContentModel } from "./model";
import { buildContentTranslationRoutes } from "./translation-routes";

/**
 * A localized content type with `publication` and **without** `editorial`.
 *
 * A legal combination since Stage 5B, and the one that used to have nowhere to
 * go: the translation table grew `status` and `publishedAt`, and the routes that
 * move them were gated on `editorial` - so the columns existed and nothing
 * generated could change them. Publication is independent of revision history,
 * and these tests are what says so.
 */
const page = createContentModel(testStrictLocalizedPageContentType);
const PLUGIN_ID = "@vitnode/example";

const emitted = vi.fn((_name: string, _payload: unknown) => ({
  failures: [],
  listeners: 0,
}));
const permissionChecks: { module: string; permission: string }[] = [];

vi.mock("../../api/lib/check-staff-permission", () => ({
  assertStaffPermission: async (
    _c: unknown,
    args: { module: string; permission: string },
  ) => {
    permissionChecks.push({
      module: args.module,
      permission: args.permission,
    });

    return await Promise.resolve();
  },
}));

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

const row = (overrides: Record<string, unknown> = {}) => ({
  createdAt: new Date("2026-01-01T00:00:00Z"),
  itemId: 7,
  languageId: 2,
  locale: "pl",
  publishedAt: null,
  status: "draft",
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  values: { featured: false, slug: "witaj", title: "Witaj" },
  version: 1,
  ...overrides,
});

const harness = () => {
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
    findManyForItem: vi.fn(),
    findManyRowsForItem: vi.fn().mockResolvedValue([]),
    publish: vi.fn(),
    resolveDefaultLanguage: vi.fn(),
    resolveLanguage: vi.fn(),
    unpublish: vi.fn(),
    update: vi.fn(),
  };

  permissionChecks.length = 0;
  vi.spyOn(page, "translationService", "get").mockReturnValue(
    () => translations,
  );

  const app = new OpenAPIHono();
  const context: MiddlewareHandler = async (c, next) => {
    c.set("admin", { user: adminUser });
    c.set("events", { emit: emitted } as never);
    await next();
  };
  app.use("*", context);

  for (const { handler, route } of buildContentTranslationRoutes(page, {
    pluginId: PLUGIN_ID,
  })) {
    app.openapi(route, handler);
  }

  return { app, translations };
};

const post = async (app: OpenAPIHono, path: string) =>
  await app.request(path, {
    body: JSON.stringify({ expectedVersion: 1 }),
    headers: { "content-type": "application/json" },
    method: "post",
  });

beforeEach(() => {
  vi.restoreAllMocks();
  emitted.mockClear();
});

describe("route registration without editorial", () => {
  const paths = () =>
    buildContentTranslationRoutes(page, { pluginId: PLUGIN_ID }).map(
      entry => `${entry.route.method.toUpperCase()} ${entry.route.path}`,
    );

  it("generates publish and unpublish from `publication` alone", () => {
    expect(paths()).toEqual(
      expect.arrayContaining([
        "POST /{id}/translations/{locale}/publish",
        "POST /{id}/translations/{locale}/unpublish",
      ]),
    );
  });

  it("generates no history routes", () => {
    // Publication moves a status; editorial records what the values were. A
    // content type that asked for the first must not be given the second.
    expect(paths().some(path => path.includes("revisions"))).toBe(false);
  });

  it("still requires `can_publish` for the transition", async () => {
    const { app, translations } = harness();
    translations.publish.mockResolvedValue({
      changed: true,
      row: row({ status: "published", version: 2 }),
      version: 2,
    });

    await post(app, "/7/translations/pl/publish");

    expect(permissionChecks).toEqual([
      { module: "strict_localized_page", permission: "can_publish" },
    ]);
  });
});

describe("publishing a translation without editorial", () => {
  it("moves the status through the repository and announces it once", async () => {
    const { app, translations } = harness();
    translations.publish.mockResolvedValue({
      changed: true,
      row: row({ status: "published", version: 2 }),
      version: 2,
    });

    const response = await post(app, "/7/translations/pl/publish");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      changed: true,
      row: { status: "published", version: 2 },
    });
    expect(translations.publish).toHaveBeenCalledWith(7, "pl", {
      expectedVersion: 1,
    });
    expect(emitted).toHaveBeenCalledTimes(1);
    expect(emitted.mock.calls[0][0]).toBe(
      "content.test.strict-localized-page.translation_published",
    );
  });

  it("carries no revision id in the event, because there is no history", async () => {
    const { app, translations } = harness();
    translations.publish.mockResolvedValue({
      changed: true,
      row: row({ status: "published", version: 2 }),
      version: 2,
    });

    await post(app, "/7/translations/pl/publish");

    // Absent rather than null: a listener checks `"revisionId" in payload`
    // before acting on one, and this content type never writes any.
    expect(emitted.mock.calls[0][1]).not.toHaveProperty("revisionId");
    expect(emitted.mock.calls[0][1]).toMatchObject({
      contentId: 7,
      locale: "pl",
      version: 2,
    });
  });

  it("is a true no-op when the translation is already published", async () => {
    const { app, translations } = harness();
    translations.publish.mockResolvedValue({
      changed: false,
      row: row({ status: "published", version: 2 }),
      version: 2,
    });

    const response = await post(app, "/7/translations/pl/publish");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ changed: false });
    // No version bump, and therefore no event: a double-clicked button must not
    // look like two publications.
    expect(emitted).not.toHaveBeenCalled();
  });

  it("unpublishes and announces that too", async () => {
    const { app, translations } = harness();
    translations.unpublish.mockResolvedValue({
      changed: true,
      row: row({ publishedAt: new Date("2026-01-01T00:00:00Z"), version: 3 }),
      version: 3,
    });

    const response = await post(app, "/7/translations/pl/unpublish");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      changed: true,
      row: { status: "draft" },
    });
    expect(emitted).toHaveBeenCalledTimes(1);
    expect(emitted.mock.calls[0][0]).toBe(
      "content.test.strict-localized-page.translation_unpublished",
    );
  });

  it("is 404 when the locale has no translation", async () => {
    const { app, translations } = harness();
    translations.publish.mockResolvedValue(null);

    expect((await post(app, "/7/translations/de/publish")).status).toBe(404);
    expect(emitted).not.toHaveBeenCalled();
  });
});
