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
  headline: null,
  phone: null,
  showRealName: false,
  firstName: null,
  lastName: null,
  avatarUrl: null,
  birthday: null,
  coverUrl: null,
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

const translationRow = (itemId: number, title: string, locale = "pl") => ({
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  itemId,
  languageId: locale === "en" ? 1 : 2,
  locale,
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
  const findManyRowsForItems = vi.fn().mockResolvedValue([]);

  vi.spyOn(guides, "service").mockReturnValue({
    findMany,
    relations: {},
    repeatable: {},
  } as never);
  vi.spyOn(guides, "translationService", "get").mockReturnValue(
    () => ({ findManyRowsForItems }) as never,
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

  return { app, findMany, findManyRowsForItems };
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

/** The resolved `localizedValues.title` of every edge. */
const displayTitles = async (response: Response): Promise<unknown[]> => {
  const body = (await response.json()) as {
    edges: { localizedValues?: Record<string, unknown> }[];
  };

  return body.edges.map(edge => edge.localizedValues?.title);
};

describe("the localized admin list", () => {
  it("reads the whole page's translations in one call", async () => {
    const { app, findManyRowsForItems } = harness();
    findManyRowsForItems.mockResolvedValue([
      translationRow(1, "Witaj"),
      translationRow(3, "Cześć"),
    ]);

    const response = await app.request("/?locale=pl");

    expect(response.status).toBe(200);
    expect(findManyRowsForItems).toHaveBeenCalledTimes(1);
    expect(findManyRowsForItems).toHaveBeenCalledWith([1, 2, 3]);
  });

  it("pairs each translation back onto its own row", async () => {
    const { app, findManyRowsForItems } = harness();
    findManyRowsForItems.mockResolvedValue([
      translationRow(3, "Cześć"),
      translationRow(1, "Witaj"),
    ]);

    const response = await app.request("/?locale=pl");

    await expect(titles(response)).resolves.toEqual(["Witaj", null, "Cześć"]);
  });

  it("shows the default language where the viewed one has no text", async () => {
    const { app, findManyRowsForItems } = harness();
    findManyRowsForItems.mockResolvedValue([
      translationRow(1, "Hello", "en"),
      translationRow(1, "Witaj"),
      translationRow(2, "Hello again", "en"),
      translationRow(3, "  "),
      translationRow(3, "Third", "en"),
    ]);

    const response = await app.request("/?locale=pl");

    await expect(displayTitles(response)).resolves.toEqual([
      "Witaj",
      "Hello again",
      "Third",
    ]);
  });

  it("resolves in the default language when the list names no language", async () => {
    const { app, findManyRowsForItems } = harness();
    findManyRowsForItems.mockResolvedValue([
      translationRow(1, "Witaj"),
      translationRow(1, "Hello", "en"),
    ]);

    const response = await app.request("/");

    await expect(titles(response)).resolves.toEqual([null, null, null]);
    await expect(displayTitles(await app.request("/"))).resolves.toEqual([
      "Hello",
      null,
      null,
    ]);
  });

  it("reads a locale the install does not have as no translation", async () => {
    const { app, findManyRowsForItems } = harness();
    findManyRowsForItems.mockResolvedValue([translationRow(2, "Witaj")]);

    const response = await app.request("/?locale=de");

    await expect(titles(response)).resolves.toEqual([null, null, null]);
    await expect(
      displayTitles(await app.request("/?locale=de")),
    ).resolves.toEqual([null, "Witaj", null]);
  });
});
