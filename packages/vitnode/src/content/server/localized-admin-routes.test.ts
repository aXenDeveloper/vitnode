// @vitest-environment node
import type { MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  testCategoryContentType,
  testLocalizedGuideContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import {
  ContentTranslationVersionConflict,
  ContentVersionConflict,
} from "../errors";
import { buildContentLocalizedAdminRoutes } from "./localized-admin-routes";
import { createContentModel } from "./model";
import { buildContentRoutes } from "./routes";

let granted = new Set<string>([
  "can_create",
  "can_edit",
  "can_translate",
  "can_view",
]);
const permissionChecks: string[] = [];

vi.mock("../../api/lib/check-staff-permission", () => ({
  assertStaffPermission: async (_c: unknown, args: { permission: string }) => {
    permissionChecks.push(args.permission);
    if (!granted.has(args.permission)) {
      const { HTTPException } = await import("hono/http-exception");
      throw new HTTPException(403, { message: "Forbidden" });
    }
  },
}));

const guides = createContentModel(testLocalizedGuideContentType);
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

const row = (overrides: Record<string, unknown> = {}) => ({
  createdAt: new Date("2026-01-01T00:00:00Z"),
  featured: false,
  id: 7,
  publishedAt: null,
  status: "draft",
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  version: 3,
  ...overrides,
});

const translationRow = (overrides: Record<string, unknown> = {}) => ({
  createdAt: new Date("2026-01-01T00:00:00Z"),
  itemId: 7,
  languageId: 1,
  locale: "en",
  publishedAt: null,
  status: "draft",
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  values: { body: null, slug: "hello", summary: null, title: "Hello" },
  version: 2,
  ...overrides,
});

const translationOutcome = (overrides: Record<string, unknown> = {}) => ({
  changed: true,
  changedFields: ["title"],
  languageId: 1,
  locale: "en",
  operation: "update",
  previousSlug: null,
  restoredFromRevisionId: null,
  revisionId: 11,
  row: translationRow(),
  version: 3,
  ...overrides,
});

/**
 * Whether the write that just ran was inside a transaction that committed.
 *
 * The `db` stub runs the callback and remembers whether it threw - which is
 * exactly the property under test: one refusal anywhere in a composite save has
 * to take the whole save with it.
 */
interface TxLog {
  committed: boolean;
  entered: boolean;
}

const harness = () => {
  const tx = { commit: vi.fn() };
  const txLog: TxLog = { committed: false, entered: false };

  const editorial = {
    create: vi.fn(),
    update: vi.fn(),
  };
  const translationEditorial = {
    create: vi.fn(),
    update: vi.fn(),
  };
  const service = {
    advancedFields: vi.fn().mockResolvedValue({}),
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(row()),
    update: vi.fn(),
  };
  const translations = {
    create: vi.fn(),
    findManyForItem: vi.fn().mockResolvedValue([]),
    findManyRowsForItem: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
  };

  vi.spyOn(guides, "service").mockReturnValue(service as never);
  vi.spyOn(
    guides as unknown as { editorialService: unknown },
    "editorialService",
    "get",
  ).mockReturnValue(() => editorial);
  vi.spyOn(
    guides as unknown as { translationService: unknown },
    "translationService",
    "get",
  ).mockReturnValue(() => translations);
  vi.spyOn(
    guides as unknown as { translationEditorialService: unknown },
    "translationEditorialService",
    "get",
  ).mockReturnValue(() => translationEditorial);

  const app = new OpenAPIHono();
  const context: MiddlewareHandler = async (c, next) => {
    c.set("admin", { user: adminUser });
    c.set("events", {
      emit: vi.fn(
        async () => await Promise.resolve({ failures: [], listeners: 0 }),
      ),
    } as never);
    c.set("db", {
      transaction: async (run: (handle: unknown) => Promise<unknown>) => {
        txLog.entered = true;
        const result = await run(tx);
        txLog.committed = true;

        return result;
      },
    } as never);
    await next();
  };
  app.use("*", context);

  for (const { handler, route } of buildContentLocalizedAdminRoutes(guides, {
    pluginId: PLUGIN_ID,
  })) {
    app.openapi(route, handler);
  }

  return { app, editorial, service, translationEditorial, translations, txLog };
};

const post = async (
  app: OpenAPIHono,
  path: string,
  method: string,
  body: unknown,
) =>
  await app.request(path, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method,
  });

beforeEach(() => {
  vi.restoreAllMocks();
  granted = new Set(["can_create", "can_edit", "can_translate", "can_view"]);
  permissionChecks.length = 0;
});

describe("route registration", () => {
  it("adds the composite pair to a localized content type", () => {
    const paths = buildContentRoutes(guides, { pluginId: PLUGIN_ID }).map(
      entry => `${entry.route.method.toUpperCase()} ${entry.route.path}`,
    );

    expect(paths).toEqual(
      expect.arrayContaining(["POST /localized", "PUT /{id}/localized"]),
    );
  });

  it("adds neither to a content type without localization", () => {
    const paths = buildContentRoutes(posts, { pluginId: PLUGIN_ID }).map(
      entry => entry.route.path,
    );

    expect(paths.some(path => path.includes("localized"))).toBe(false);
  });

  it("refuses to build them for a content type without localization", () => {
    expect(() =>
      buildContentLocalizedAdminRoutes(posts, { pluginId: PLUGIN_ID }),
    ).toThrow(/needs a localized content type/);
  });
});

describe("POST /localized", () => {
  it("writes the base row and the default translation in one transaction", async () => {
    const { app, editorial, translationEditorial, txLog } = harness();
    editorial.create.mockResolvedValue({
      changed: true,
      changedFields: [],
      operation: "create",
      previousSlug: null,
      restoredFromRevisionId: null,
      revisionId: 4,
      row: row(),
      version: 1,
    });
    translationEditorial.create.mockResolvedValue(
      translationOutcome({ operation: "create" }),
    );

    const response = await post(app, "/localized", "POST", {
      translations: [
        { locale: "en", values: { slug: "hello", title: "Hello" } },
      ],
      values: { featured: true },
    });

    expect(response.status).toBe(201);
    expect(txLog.committed).toBe(true);
    // Both halves ran on the *same* handle, which is what makes the pair atomic.
    expect(editorial.create.mock.calls[0][1].tx).toBeDefined();
    expect(translationEditorial.create.mock.calls[0][3].tx).toBe(
      editorial.create.mock.calls[0][1].tx,
    );
  });

  it("refuses a create with no default-locale translation", async () => {
    const { app, editorial, txLog } = harness();

    const response = await post(app, "/localized", "POST", {
      // The editor was working in Polish, and the record must exist in English.
      translations: [
        { locale: "pl", values: { slug: "witaj", title: "Witaj" } },
      ],
      values: { featured: false },
    });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain('"en"');
    // Nothing was written, and nothing was copied between languages to paper
    // over the gap.
    expect(editorial.create).not.toHaveBeenCalled();
    expect(txLog.entered).toBe(false);
  });

  it("writes the default translation before any other language", async () => {
    const { app, editorial, translationEditorial } = harness();
    editorial.create.mockResolvedValue({
      changed: true,
      changedFields: [],
      operation: "create",
      previousSlug: null,
      restoredFromRevisionId: null,
      revisionId: 4,
      row: row(),
      version: 1,
    });
    translationEditorial.create.mockImplementation(
      async (_id: number, locale: string) =>
        await Promise.resolve(
          translationOutcome({ locale, operation: "create" }),
        ),
    );

    await post(app, "/localized", "POST", {
      translations: [
        { locale: "pl", values: { slug: "witaj", title: "Witaj" } },
        { locale: "en", values: { slug: "hello", title: "Hello" } },
      ],
      values: { featured: false },
    });

    expect(translationEditorial.create.mock.calls.map(call => call[1])).toEqual(
      ["en", "pl"],
    );
  });

  it("rolls the whole create back when one language is refused", async () => {
    const { app, editorial, translationEditorial } = harness();
    editorial.create.mockResolvedValue({
      changed: true,
      changedFields: [],
      operation: "create",
      previousSlug: null,
      restoredFromRevisionId: null,
      revisionId: 4,
      row: row(),
      version: 1,
    });
    translationEditorial.create.mockImplementation(
      async (_id: number, locale: string) => {
        if (locale === "pl") {
          throw new ContentTranslationVersionConflict({
            contentTypeId: "test.localized-guide",
            currentVersion: 2,
            expectedVersion: 1,
            itemId: 7,
            locale: "pl",
          });
        }

        return await Promise.resolve(
          translationOutcome({ locale, operation: "create" }),
        );
      },
    );

    const response = await post(app, "/localized", "POST", {
      translations: [
        { locale: "en", values: { slug: "hello", title: "Hello" } },
        { locale: "pl", values: { slug: "witaj", title: "Witaj" } },
      ],
      values: { featured: false },
    });

    expect(response.status).toBe(409);
    expect((await response.json()) as { locale: string }).toMatchObject({
      locale: "pl",
    });
  });
});

describe("PUT /{id}/localized", () => {
  const sharedOutcome = {
    changed: true,
    changedFields: ["featured"],
    operation: "update",
    previousSlug: null,
    restoredFromRevisionId: null,
    revisionId: 9,
    row: row({ featured: true, version: 4 }),
    version: 4,
  };

  it("saves shared fields and two languages in one transaction", async () => {
    const { app, editorial, translationEditorial, txLog } = harness();
    editorial.update.mockResolvedValue(sharedOutcome);
    translationEditorial.update.mockImplementation(
      async (_id: number, locale: string) =>
        await Promise.resolve(translationOutcome({ locale })),
    );

    const response = await post(app, "/7/localized", "PUT", {
      expectedVersion: 3,
      translations: [
        { expectedVersion: 2, locale: "en", values: { title: "Hello v2" } },
        { expectedVersion: 5, locale: "pl", values: { title: "Witaj v2" } },
      ],
      values: { featured: true },
    });

    expect(response.status).toBe(200);
    expect(txLog.committed).toBe(true);
    // Each half carries its own precondition: the base row's version and each
    // translation's own. That is what lets two translators work at once.
    expect(editorial.update.mock.calls[0][2].expectedVersion).toBe(3);
    expect(translationEditorial.update.mock.calls[0][3].expectedVersion).toBe(
      2,
    );
    expect(translationEditorial.update.mock.calls[1][3].expectedVersion).toBe(
      5,
    );
  });

  it("touches nothing shared when only one language changed", async () => {
    const { app, editorial, translationEditorial } = harness();
    translationEditorial.update.mockResolvedValue(
      translationOutcome({ locale: "pl" }),
    );

    const response = await post(app, "/7/localized", "PUT", {
      translations: [
        { expectedVersion: 5, locale: "pl", values: { title: "Witaj v2" } },
      ],
    });

    expect(response.status).toBe(200);
    // No base update at all: no version bump, no base revision, no `updated`
    // event, and nothing for the English cache to expire.
    expect(editorial.update).not.toHaveBeenCalled();
    expect(translationEditorial.update).toHaveBeenCalledTimes(1);
    expect(translationEditorial.update.mock.calls[0][1]).toBe("pl");
  });

  it("commits nothing when one language's version moved", async () => {
    const { app, editorial, translationEditorial } = harness();
    editorial.update.mockResolvedValue(sharedOutcome);
    translationEditorial.update.mockImplementation(
      async (_id: number, locale: string) => {
        if (locale === "en") {
          throw new ContentTranslationVersionConflict({
            contentTypeId: "test.localized-guide",
            currentVersion: 7,
            expectedVersion: 2,
            itemId: 7,
            locale: "en",
          });
        }

        return await Promise.resolve(translationOutcome({ locale }));
      },
    );

    const response = await post(app, "/7/localized", "PUT", {
      expectedVersion: 3,
      translations: [
        { expectedVersion: 2, locale: "en", values: { title: "Hello v2" } },
        { expectedVersion: 5, locale: "pl", values: { title: "Witaj v2" } },
      ],
      values: { featured: true },
    });

    // The transaction threw, so the shared write and the Polish write are gone
    // with it - "shared saved, English conflicted" is exactly the state a single
    // Save button must never leave behind.
    expect(response.status).toBe(409);
    const body = (await response.json()) as { code: string; locale: string };
    expect(body).toMatchObject({
      code: "CONTENT_TRANSLATION_VERSION_CONFLICT",
      locale: "en",
    });
  });

  it("reports a base version conflict before writing any language", async () => {
    const { app, editorial, translationEditorial } = harness();
    editorial.update.mockRejectedValue(
      new ContentVersionConflict({
        contentTypeId: "test.localized-guide",
        currentVersion: 9,
        expectedVersion: 3,
        itemId: 7,
      }),
    );

    const response = await post(app, "/7/localized", "PUT", {
      expectedVersion: 3,
      translations: [
        { expectedVersion: 2, locale: "en", values: { title: "Hello v2" } },
      ],
      values: { featured: true },
    });

    expect(response.status).toBe(409);
    expect((await response.json()) as { code: string }).toMatchObject({
      code: "CONTENT_VERSION_CONFLICT",
    });
    expect(editorial.update).toHaveBeenCalledTimes(1);
    expect(translationEditorial.update).not.toHaveBeenCalled();
  });

  it("needs `expectedVersion` to change a shared field", async () => {
    const { app } = harness();

    const response = await post(app, "/7/localized", "PUT", {
      translations: [],
      values: { featured: true },
    });

    expect(response.status).toBe(400);
  });

  it("lets a translator write a language without `can_edit`", async () => {
    const { app, translationEditorial } = harness();
    granted = new Set(["can_translate", "can_view"]);
    translationEditorial.update.mockResolvedValue(
      translationOutcome({ locale: "pl" }),
    );

    const response = await post(app, "/7/localized", "PUT", {
      translations: [
        { expectedVersion: 5, locale: "pl", values: { title: "Witaj v2" } },
      ],
    });

    expect(response.status).toBe(200);
  });

  it("refuses a translator who tries to change a shared field", async () => {
    const { app, editorial } = harness();
    granted = new Set(["can_translate", "can_view"]);

    const response = await post(app, "/7/localized", "PUT", {
      expectedVersion: 3,
      translations: [],
      values: { featured: true },
    });

    // Gated on the server, not on whether the browser disabled an input.
    expect(response.status).toBe(403);
    expect(permissionChecks).toContain("can_edit");
    expect(editorial.update).not.toHaveBeenCalled();
  });
});
