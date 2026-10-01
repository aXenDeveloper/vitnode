// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EnvVariablesVitNode } from "@/api/middlewares/global.middleware";
import type { SSOApiPlugin, SSOProviderUser } from "@/api/models/sso";

import { SessionModel } from "@/api/models/session";
import { SessionAdminModel } from "@/api/models/session-admin";
import { SsoConnectionModel } from "@/api/models/sso-connection";

import { ssoUserModule } from "../sso.module";

const PROVIDER_USER: SSOProviderUser = {
  avatarUrl: "https://lh3.googleusercontent.test/a/photo.png",
  email: "Alice@Example.test",
  firstName: "Alice",
  id: "google-alice",
  lastName: "Smith",
  username: "Alice Smith",
};

const fakeDb = (rows: unknown[][]) => {
  const queue = [...rows];
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    limit: () => chain,
    then: async (onFulfilled: (value: unknown) => unknown) =>
      await Promise.resolve(onFulfilled(queue.shift() ?? [])),
    where: () => chain,
  };
  const updates = vi.fn();
  const db = {
    select: () => chain,
    transaction: async (run: (tx: unknown) => Promise<unknown>) =>
      await run(db),
    update: () => ({
      set: (values: unknown) => ({
        where: async () => {
          updates(values);
          await Promise.resolve();
        },
      }),
    }),
  };

  return { db, updates };
};

const harness = (rows: unknown[][]) => {
  const google: SSOApiPlugin = {
    fetchToken: vi.fn(async () =>
      Promise.resolve({ access_token: "token", token_type: "Bearer" }),
    ),
    fetchUser: vi.fn(async () => Promise.resolve(PROVIDER_USER)),
    getUrl: ({ state }) => `https://google.example/oauth?state=${state}`,
    id: "google",
    name: "Google",
    profileFields: ["avatar", "firstName", "lastName"],
  };
  const { db, updates } = fakeDb(rows);
  const createSession = vi
    .spyOn(SessionModel.prototype, "createSessionByUserId")
    .mockResolvedValue({ token: "session-token" });
  const createAdminSession = vi
    .spyOn(SessionAdminModel.prototype, "createSessionByUserId")
    .mockResolvedValue({ token: "admin-token" });
  const afterSignIn = vi
    .spyOn(SsoConnectionModel.prototype, "afterSignIn")
    .mockResolvedValue(undefined);

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("core", {
      authorization: {
        adminCookieExpires: 1000 * 60 * 60 * 24,
        adminCookieName: "vitnode_auth_admin",
        cookieDomain: undefined,
        cookie_expires: 1000 * 60 * 60 * 24 * 90,
        cookieName: "vitnode_auth",
        cookieSecure: true,
        deviceCookieExpires: 1000 * 60 * 60 * 24 * 365,
        deviceCookieName: "vitnode_device",
        passkeys: { enabled: false, problems: [] },
        password: { enabled: true },
        ssoAdapters: [google],
      },
    } as unknown as EnvVariablesVitNode["core"]);
    c.set("user", null as Context["var"]["user"]);
    c.set("db", db as unknown as Context["var"]["db"]);
    await next();
  });
  app.route("/", ssoUserModule.hono);

  const signInThroughGoogle = async () => {
    const start = await app.request("/google", { method: "POST" });
    const { url } = (await start.json()) as { url: string };
    const state = new URL(url).searchParams.get("state") ?? "";
    const cookie = start.headers
      .getSetCookie()
      .map(line => line.split(";")[0])
      .join("; ");

    return await app.request(
      `/google/callback?code=provider-code&state=${state}`,
      { headers: { cookie } },
    );
  };

  return {
    afterSignIn,
    app,
    createAdminSession,
    createSession,
    signInThroughGoogle,
    updates,
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("signing in through an SSO provider", () => {
  it("still signs a returning member in with a public session only", async () => {
    const h = harness([
      [{ email: "alice@example.test", emailVerified: true, userId: 7 }],
    ]);

    const response = await h.signInThroughGoogle();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 7, token: "session-token" });
    expect(h.createSession).toHaveBeenCalledWith(7);
    expect(h.createAdminSession).not.toHaveBeenCalled();
    expect(response.headers.getSetCookie().join(";")).not.toContain(
      "vitnode_auth_admin",
    );
  });

  it("hands the normalized provider profile to the sign-in sync", async () => {
    const h = harness([
      [{ email: "alice@example.test", emailVerified: true, userId: 7 }],
    ]);

    await h.signInThroughGoogle();

    expect(h.afterSignIn).toHaveBeenCalledWith({
      identity: {
        email: "alice@example.test",
        id: "google-alice",
        profile: {
          avatarUrl: "https://lh3.googleusercontent.test/a/photo.png",
          firstName: "Alice",
          lastName: "Smith",
        },
        username: "Alice Smith",
      },
      providerId: "google",
      userId: 7,
    });
  });

  it("still confirms an unverified account whose email the provider vouches for", async () => {
    const h = harness([
      [{ email: "alice@example.test", emailVerified: false, userId: 7 }],
    ]);

    await h.signInThroughGoogle();

    expect(h.updates).toHaveBeenCalledWith({ emailVerified: true });
  });

  it("rejects a callback without the browser's state cookie", async () => {
    const h = harness([]);

    const response = await h.app.request(
      "/google/callback?code=provider-code&state=0123456789abcdef",
    );

    expect(response.status).toBe(400);
    expect(h.createSession).not.toHaveBeenCalled();
  });
});
