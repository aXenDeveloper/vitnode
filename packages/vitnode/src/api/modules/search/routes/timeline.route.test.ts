// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { buildRoute } from "@/api/lib/route";

import { timelineUserAdminRoute } from "../../admin/users/routes/timeline.route";
import { timelineRoute } from "./timeline.route";

const { assertStaffPermission } = vi.hoisted(() => ({
  assertStaffPermission: vi.fn(async () => {
    await Promise.resolve();
  }),
}));

vi.mock("@/api/lib/check-staff-permission", () => ({ assertStaffPermission }));

const EMPTY_RESULT = {
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

const appFor = (
  built: ReturnType<typeof buildRoute>,
  viewer: null | { id: number },
) => {
  const search = {
    search: vi.fn(async () => {
      await Promise.resolve();

      return EMPTY_RESULT;
    }),
  };
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("search", search as unknown as Context["var"]["search"]);
    c.set("user", viewer as unknown as Context["var"]["user"]);
    await next();
  });
  app.openapi(built.route, built.handler);

  return { app, search };
};

describe("member timeline", () => {
  beforeEach(() => {
    assertStaffPermission.mockClear();
  });

  it("shows a guest only public documents", async () => {
    const { app, search } = appFor(timelineRoute, null);

    const res = await app.request("/timeline/1?lang=en&first=20");

    expect(res.status).toBe(200);
    expect(search.search).toHaveBeenCalledWith({
      authorId: 1,
      cursor: undefined,
      first: 20,
      includePrivate: false,
      languageCode: "en",
      sort: "newest",
    });
  });

  it("shows another member only public documents", async () => {
    const { app, search } = appFor(timelineRoute, { id: 2 });

    await app.request("/timeline/1");

    expect(search.search).toHaveBeenCalledWith(
      expect.objectContaining({ authorId: 1, includePrivate: false }),
    );
  });

  it("shows members their own drafts", async () => {
    const { app, search } = appFor(timelineRoute, { id: 1 });

    await app.request("/timeline/1?cursor=42");

    expect(search.search).toHaveBeenCalledWith(
      expect.objectContaining({
        authorId: 1,
        cursor: "42",
        includePrivate: true,
      }),
    );
  });

  it("refuses an id that is not a number", async () => {
    const { app, search } = appFor(timelineRoute, { id: 1 });

    const res = await app.request("/timeline/abc");

    expect(res.status).toBe(400);
    expect(search.search).not.toHaveBeenCalled();
  });

  it("needs no staff permission", async () => {
    const { app } = appFor(timelineRoute, null);

    await app.request("/timeline/1");

    expect(assertStaffPermission).not.toHaveBeenCalled();
  });
});

describe("AdminCP user timeline", () => {
  beforeEach(() => {
    assertStaffPermission.mockClear();
  });

  it("shows every state, whoever the author is", async () => {
    const { app, search } = appFor(timelineUserAdminRoute, { id: 9 });

    const res = await app.request("/1/timeline?lang=pl");

    expect(res.status).toBe(200);
    expect(search.search).toHaveBeenCalledWith(
      expect.objectContaining({
        authorId: 1,
        includePrivate: true,
        languageCode: "pl",
        sort: "newest",
      }),
    );
  });

  it("asks for the permission to view users", async () => {
    const { app } = appFor(timelineUserAdminRoute, { id: 9 });

    await app.request("/1/timeline");

    expect(assertStaffPermission).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        module: "users",
        permission: "can_view",
        type: "admin",
      }),
    );
  });
});
