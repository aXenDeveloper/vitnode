// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import { createTestCache } from "@/tests/cache";
import {
  grantStaffPermissions,
  ROOT_STAFF_PERMISSIONS,
} from "@/tests/staff-permissions";

import { sessionAdminRoute } from "./session.route";

const EXPIRES_AT = new Date("2026-09-29T12:00:00.000Z");

const readSession = async ({
  cookieDomain,
}: {
  cookieDomain: string | undefined;
}) => {
  const cache = createTestCache();
  await grantStaffPermissions(cache, {
    permissions: ROOT_STAFF_PERMISSIONS,
    userId: 7,
  });
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("admin", {
      user: { id: 7, roleId: 1 },
    } as unknown as Context["var"]["admin"]);
    c.set("adminSessionExpiresAt", EXPIRES_AT);
    c.set("cache", cache);
    c.set("core", {
      authorization: { cookieDomain },
    } as unknown as Context["var"]["core"]);
    await next();
  });
  app.openapi(sessionAdminRoute.route, sessionAdminRoute.handler);

  const response = await app.request("/session");

  return {
    body: (await response.json()) as {
      expiresAt: string;
      signOutWhenTabsClose: boolean;
    },
    status: response.status,
  };
};

describe("admin session", () => {
  it("reports when it expires", async () => {
    const { body, status } = await readSession({ cookieDomain: undefined });

    expect(status).toBe(200);
    expect(body.expiresAt).toBe(EXPIRES_AT.toISOString());
  });

  it("ends with the last AdminCP tab when its cookie is host-only", async () => {
    const { body } = await readSession({ cookieDomain: undefined });

    expect(body.signOutWhenTabsClose).toBe(true);
  });

  it("outlives closed tabs when its cookie is shared across subdomains", async () => {
    const { body } = await readSession({ cookieDomain: ".example.com" });

    expect(body.signOutWhenTabsClose).toBe(false);
  });
});
