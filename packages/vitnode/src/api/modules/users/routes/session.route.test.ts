// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import type { Route } from "@/api/lib/route";

import { invalidateStaffEntry } from "@/api/lib/staff-permission-cache";
import { core_admin_permissions } from "@/database/admins";
import { core_moderators_permissions } from "@/database/moderators";
import { core_roles } from "@/database/roles";
import { core_users, core_users_secondary_roles } from "@/database/users";
import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { sessionRoute } from "./session.route";

const ROOT_ROLE = 1;
const MEMBER_ROLE = 3;

const USER = {
  email: "user@example.com",
  id: 7,
  name: "User",
  roleId: MEMBER_ROLE,
};

type Shape = "admin" | "member" | "moderator" | "root via a secondary role";

const sessionApp = (shape: null | Shape) => {
  const { db } = createMemoryDb([
    [core_users, [USER]],
    [
      core_users_secondary_roles,
      shape === "root via a secondary role"
        ? [{ roleId: ROOT_ROLE, userId: USER.id }]
        : [],
    ],
    [
      core_roles,
      [
        { id: ROOT_ROLE, root: true },
        { id: MEMBER_ROLE, root: false },
      ],
    ],
    [
      core_admin_permissions,
      shape === "admin"
        ? [
            {
              permissions: [],
              roleId: null,
              unrestricted: false,
              userId: USER.id,
            },
          ]
        : [],
    ],
    [
      core_moderators_permissions,
      shape === "moderator"
        ? [
            {
              permissions: [],
              roleId: null,
              unrestricted: false,
              userId: USER.id,
            },
          ]
        : [],
    ],
  ]);
  const cache = createTestCache();
  const context = {
    get: (key: string) => ({ cache, db })[key],
  } as unknown as Context;

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("cache", cache);
    c.set("db", db as unknown as Context["var"]["db"]);
    c.set("user", (shape ? USER : null) as unknown as Context["var"]["user"]);
    await next();
  });
  const { handler, route }: Route = sessionRoute;
  app.openapi(route, handler);

  const read = async () => {
    const response = await app.request("/session");

    return (await response.json()) as {
      user: null | { isAdmin: boolean; isModerator: boolean };
    };
  };

  return { cache, context, db, read };
};

const readSession = async (shape: null | Shape) =>
  await sessionApp(shape).read();

describe("GET /users/session", () => {
  it("reports a moderator as a moderator, not an admin", async () => {
    expect((await readSession("moderator")).user).toMatchObject({
      isAdmin: false,
      isModerator: true,
    });
  });

  it("reports root through a secondary role as both", async () => {
    expect((await readSession("root via a secondary role")).user).toMatchObject(
      { isAdmin: true, isModerator: true },
    );
  });

  it("reports a member as neither", async () => {
    expect((await readSession("member")).user).toMatchObject({
      isAdmin: false,
      isModerator: false,
    });
  });

  it("reports an admin as an admin, not a moderator", async () => {
    expect((await readSession("admin")).user).toMatchObject({
      isAdmin: true,
      isModerator: false,
    });
  });

  it("reports cached grants without waiting for the database", async () => {
    const session = sessionApp("member");
    await grantStaffPermissions(session.cache, {
      permissions: [],
      userId: USER.id,
    });

    expect((await session.read()).user).toMatchObject({
      isAdmin: true,
      isModerator: false,
    });
  });

  it("stops reporting a revoked moderator once the entry is invalidated", async () => {
    const session = sessionApp("moderator");
    expect((await session.read()).user).toMatchObject({ isModerator: true });

    await session.db.delete(core_moderators_permissions);
    expect((await session.read()).user).toMatchObject({ isModerator: true });

    await invalidateStaffEntry(session.context, { userId: USER.id });
    expect((await session.read()).user).toMatchObject({
      isAdmin: false,
      isModerator: false,
    });
  });

  it("answers with no user when signed out", async () => {
    expect(await readSession(null)).toEqual({ user: null });
  });
});
