// @vitest-environment node
import type { MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  testArticleContentType,
  testCategoryContentType,
} from "@/tests/content-fixtures";

import { createContentModel } from "./model";
import { buildContentRoutes } from "./routes";

vi.mock("../../api/lib/check-staff-permission", () => ({
  assertStaffPermission: async () => await Promise.resolve(),
}));

const categories = createContentModel(testCategoryContentType);
const articles = createContentModel(testArticleContentType, {
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

const harness = () => {
  const findMany = vi.fn().mockResolvedValue({
    edges: [],
    pageInfo: {
      count: 0,
      endCursor: null,
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: null,
      totalCount: 0,
    },
  });
  vi.spyOn(articles, "service").mockReturnValue({
    findMany,
    relations: {},
    repeatable: {},
  } as never);

  const app = new OpenAPIHono();
  const context: MiddlewareHandler = async (c, next) => {
    c.set("admin", { user: adminUser });
    await next();
  };
  app.use("*", context);
  for (const { handler, route } of buildContentRoutes(articles, {
    pluginId: PLUGIN_ID,
  })) {
    app.openapi(route, handler);
  }

  return { app, findMany };
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("pagination input a list route refuses", () => {
  it.each([
    ["first=0", "first=0"],
    ["last=0", "last=0"],
    ["first=-1", "first=-1"],
    ["last=-1", "last=-1"],
    ["first=abc", "first=abc"],
    ["last=abc", "last=abc"],
    ["a fractional page size", "first=1.5"],
    ["both first and last", "first=5&last=5"],
    ["a garbage cursor", "cursor=%21%21not-a-cursor"],
    ["an empty cursor", "cursor="],
  ])("answers 400 for %s", async (_why, query) => {
    const { app } = harness();

    const res = await app.request(`/?${query}`);

    expect([query, res.status]).toEqual([query, 400]);
  });

  it("never reaches the service with a page size it would have to clamp", async () => {
    const { app, findMany } = harness();

    await app.request("/?first=0");

    expect(findMany).not.toHaveBeenCalled();
  });

  it("still accepts a legitimate page", async () => {
    const { app, findMany } = harness();

    const res = await app.request("/?first=25");

    expect(res.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ first: "25" }),
      }),
    );
  });

  it("refuses a legacy numeric cursor on an ordering that is not the identifier", async () => {
    // The exact shape of the old bug, refused where the ordering is known: a
    // bare number says nothing about where `title` was, so honouring it would
    // skip rows. The service raises it; the route passes it through unchanged.
    const { app } = harness();
    const { HTTPException } = await import("hono/http-exception");
    vi.spyOn(articles, "service").mockReturnValue({
      findMany: vi.fn().mockImplementation(() => {
        throw new HTTPException(400, {
          message: 'This cursor cannot be used with the "title" ordering.',
        });
      }),
      relations: {},
      repeatable: {},
    } as never);

    const res = await app.request("/?orderBy=title&cursor=42");

    expect(res.status).toBe(400);
  });
});
