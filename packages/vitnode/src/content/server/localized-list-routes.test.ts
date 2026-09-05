// @vitest-environment node
import type { MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { testLocalizedGuideContentType } from "@/tests/content-fixtures";

import type * as LanguageResolverModule from "./language-resolver";

import { createContentModel } from "./model";
import { buildContentRoutes } from "./routes";

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
  };
});

const guides = createContentModel(testLocalizedGuideContentType);

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

const pageInfo = {
  count: 3,
  endCursor: null,
  hasNextPage: false,
  hasPreviousPage: false,
  startCursor: null,
  totalCount: 3,
};

const translationRow = (itemId: number, title: string) => ({
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  itemId,
  languageId: 2,
  locale: "pl",
  publishedAt: null,
  status: "draft",
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  values: { body: null, slug: `guide-${itemId}`, summary: null, title },
  version: 1,
});

const harness = () => {
  const findMany = vi.fn().mockResolvedValue({
    edges: [{ id: 1 }, { id: 2 }, { id: 3 }],
    pageInfo,
  });
  const findManyByLanguageId = vi.fn().mockResolvedValue([]);

  vi.spyOn(guides, "service").mockReturnValue({
    findMany,
    relations: {},
    repeatable: {},
  } as never);
  vi.spyOn(guides, "translationService", "get").mockReturnValue(
    () => ({ findManyByLanguageId }) as never,
  );

  const app = new OpenAPIHono();
  const context: MiddlewareHandler = async (c, next) => {
    c.set("admin", { user: adminUser });
    await next();
  };
  app.use("*", context);

  for (const { handler, route } of buildContentRoutes(guides, {
    pluginId: PLUGIN_ID,
  })) {
    app.openapi(route, handler);
  }

  return { app, findMany, findManyByLanguageId };
};

/** The `translation.title` of every edge, `null` where there is none. */
const titles = async (response: Response): Promise<(null | string)[]> => {
  const body = (await response.json()) as {
    edges: { translation: null | { title: string } }[];
  };

  return body.edges.map(edge => edge.translation?.title ?? null);
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("the localized admin list", () => {
  it("reads the whole page's translations in one call", async () => {
    const { app, findManyByLanguageId } = harness();
    findManyByLanguageId.mockResolvedValue([
      translationRow(1, "Witaj"),
      translationRow(3, "Cześć"),
    ]);

    const response = await app.request("/?locale=pl");

    expect(response.status).toBe(200);
    // Once, with every id on the page and the one language they are being read
    // in - not once per row.
    expect(findManyByLanguageId).toHaveBeenCalledTimes(1);
    expect(findManyByLanguageId).toHaveBeenCalledWith([1, 2, 3], 2);
  });

  it("pairs each translation back onto its own row", async () => {
    const { app, findManyByLanguageId } = harness();
    // Deliberately out of the page's order, and missing the middle record: a
    // batch read comes back in whatever order Postgres produced it.
    findManyByLanguageId.mockResolvedValue([
      translationRow(3, "Cześć"),
      translationRow(1, "Witaj"),
    ]);

    const response = await app.request("/?locale=pl");

    // A record with no Polish copy stays in the list as `null` rather than
    // being dropped - seeing which ones are missing is what the selector is for.
    await expect(titles(response)).resolves.toEqual(["Witaj", null, "Cześć"]);
  });

  it("attaches nothing when the list is not being viewed in a language", async () => {
    const { app, findManyByLanguageId } = harness();

    const response = await app.request("/");
    const body = (await response.json()) as { edges: object[] };

    expect(findManyByLanguageId).not.toHaveBeenCalled();
    expect(body.edges.every(edge => !("translation" in edge))).toBe(true);
  });

  it("reads a locale the install does not have as no translation", async () => {
    const { app, findManyByLanguageId } = harness();

    const response = await app.request("/?locale=de");

    expect(findManyByLanguageId).not.toHaveBeenCalled();
    await expect(titles(response)).resolves.toEqual([null, null, null]);
  });
});
