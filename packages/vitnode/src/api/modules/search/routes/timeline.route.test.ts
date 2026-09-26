// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it, vi } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";
import type { buildRoute } from "@/api/lib/route";

import { createTestCache } from "@/tests/cache";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { timelineUserAdminRoute } from "../../admin/users/routes/timeline.route";
import { timelineRoute } from "./timeline.route";

const VIEW_USERS: PermissionsStaffArgs = {
  module: "users",
  permission: "can_view",
  plugin: "@vitnode/core",
};

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

const appFor = async (
  built: ReturnType<typeof buildRoute>,
  viewer: null | { id: number },
  permissions: PermissionsStaffArgs[] = [],
) => {
  const cache = createTestCache();
  if (viewer) {
    await grantStaffPermissions(cache, { permissions, userId: viewer.id });
  }
  const search = {
    search: vi.fn(async () => {
      await Promise.resolve();

      return EMPTY_RESULT;
    }),
  };
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    if (viewer) {
      c.set("admin", {
        user: { ...viewer, roleId: 1 },
      } as unknown as Context["var"]["admin"]);
    }
    c.set("cache", cache);
    c.set("search", search as unknown as Context["var"]["search"]);
    c.set("user", viewer as unknown as Context["var"]["user"]);
    await next();
  });
  app.openapi(built.route, built.handler);

  return { app, search };
};

describe("member timeline", () => {
  it("shows a guest only public documents", async () => {
    const { app, search } = await appFor(timelineRoute, null);

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
    const { app, search } = await appFor(timelineRoute, { id: 2 });

    await app.request("/timeline/1");

    expect(search.search).toHaveBeenCalledWith(
      expect.objectContaining({ authorId: 1, includePrivate: false }),
    );
  });

  it("shows members their own drafts", async () => {
    const { app, search } = await appFor(timelineRoute, { id: 1 });

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
    const { app, search } = await appFor(timelineRoute, { id: 1 });

    const res = await app.request("/timeline/abc");

    expect(res.status).toBe(400);
    expect(search.search).not.toHaveBeenCalled();
  });

  it("needs no staff permission", async () => {
    const { app, search } = await appFor(timelineRoute, { id: 2 }, []);

    const res = await app.request("/timeline/1");

    expect(res.status).toBe(200);
    expect(search.search).toHaveBeenCalledOnce();
  });
});

describe("AdminCP user timeline", () => {
  it("shows every state, whoever the author is", async () => {
    const { app, search } = await appFor(timelineUserAdminRoute, { id: 9 }, [
      VIEW_USERS,
    ]);

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

  it("refuses an administrator without users:can_view", async () => {
    const { app, search } = await appFor(timelineUserAdminRoute, { id: 9 }, [
      { ...VIEW_USERS, permission: "can_edit" },
      { ...VIEW_USERS, module: "roles" },
      { ...VIEW_USERS, plugin: "@vitnode/blog" },
    ]);

    const res = await app.request("/1/timeline");

    expect(res.status).toBe(403);
    expect(search.search).not.toHaveBeenCalled();
  });
});
