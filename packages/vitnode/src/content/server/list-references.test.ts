// @vitest-environment node
import type { Context, MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defineContentType } from "../define";
import { field } from "../fields";
import { createContentModel } from "./model";
import { buildContentRoutes } from "./routes";

vi.mock("../../api/lib/check-staff-permission", () => ({
  assertStaffPermission: async () => {
    await Promise.resolve();
  },
}));

const coauthoredContentType = defineContentType({
  id: "test.coauthoredlist",
  tableName: "test_coauthored_list",
  fields: {
    title: field.text({ required: true }),
    authors: field.user({ multiple: true, ordered: true }),
  },
  admin: {
    titleField: "title",
    list: { columns: ["title", "authors"] },
  },
});

const unlistedContentType = defineContentType({
  id: "test.unlistedauthors",
  tableName: "test_unlisted_authors",
  fields: {
    title: field.text({ required: true }),
    authors: field.user({ multiple: true, ordered: true }),
  },
  admin: {
    titleField: "title",
    list: { columns: ["title"] },
  },
});

const coauthored = createContentModel(coauthoredContentType);
const unlisted = createContentModel(unlistedContentType);

const PAGE_INFO = {
  count: 3,
  currentPage: 1,
  endCursor: null,
  hasNextPage: false,
  hasPreviousPage: false,
  pageSize: 20,
  startCursor: null,
  totalCount: 3,
  totalPages: 1,
};

const rowOf = (id: number) => ({ id, labels: {}, title: `Post ${id}` });

const ADA = {
  label: "Ada",
  role: { color: "#ff0000", prefix: null },
  value: 3,
};
const BOB = { label: "Bob", role: { color: null, prefix: "⭐" }, value: 5 };

const harness = (model: typeof coauthored | typeof unlisted) => {
  const service = {
    findMany: vi.fn(async () => {
      await Promise.resolve();

      return { edges: [rowOf(1), rowOf(2), rowOf(3)], pageInfo: PAGE_INFO };
    }),
    options: vi.fn(async () => {
      await Promise.resolve();

      return [];
    }),
  };
  const userQuery = vi.fn(async () => {
    await Promise.resolve();

    return [
      { color: "#ff0000", label: "Ada", prefix: null, value: 3 },
      { color: null, label: "Bob", prefix: "⭐", value: 5 },
    ];
  });
  const db = {
    select: () => ({
      from: () => ({ leftJoin: () => ({ where: userQuery }) }),
    }),
  };
  vi.spyOn(model, "service").mockReturnValue(service as never);

  const loadMany = vi.spyOn(model.advanced, "loadMany").mockResolvedValue(
    new Map<number, Record<string, unknown>>([
      [1, { authors: [5, 3] }],
      [2, { authors: [] }],
      [3, { authors: [3, 9] }],
    ]),
  );

  const app = new OpenAPIHono();
  const context: MiddlewareHandler = async (c, next) => {
    c.set("admin", { user: { id: 1 } } as unknown as Context["var"]["admin"]);
    c.set("db", db as never);
    await next();
  };
  app.use("*", context);

  for (const { handler, route } of buildContentRoutes(
    model as typeof coauthored,
    { pluginId: "@vitnode/example" },
  )) {
    app.openapi(route, handler);
  }

  return { app, db, loadMany, service, userQuery };
};

interface ListBody {
  edges: { id: number; references?: Record<string, { value: number }[]> }[];
}

describe("admin list reference columns", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves every row's people in one junction read and one user read", async () => {
    const { app, db, loadMany, service, userQuery } = harness(coauthored);

    const res = await app.request("/");
    const body = (await res.json()) as ListBody;

    expect(res.status).toBe(200);
    expect(loadMany).toHaveBeenCalledTimes(1);
    expect(loadMany).toHaveBeenCalledWith([1, 2, 3], db, ["authors"]);
    expect(userQuery).toHaveBeenCalledTimes(1);
    expect(service.options).not.toHaveBeenCalled();
    expect(body.edges.map(edge => edge.references?.authors)).toEqual([
      [BOB, ADA],
      [],
      [ADA],
    ]);
  });

  it("reads nothing extra when no to-many field is a column", async () => {
    const { app, loadMany, service, userQuery } = harness(unlisted);

    const res = await app.request("/");
    const body = (await res.json()) as ListBody;

    expect(res.status).toBe(200);
    expect(loadMany).not.toHaveBeenCalled();
    expect(service.options).not.toHaveBeenCalled();
    expect(userQuery).not.toHaveBeenCalled();
    expect(body.edges[0]).not.toHaveProperty("references");
  });
});
