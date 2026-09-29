// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EnvVariablesVitNode } from "@/api/middlewares/global.middleware";

import { PasswordModel } from "@/api/models/password";
import { SessionModel } from "@/api/models/session";
import { SessionAdminModel } from "@/api/models/session-admin";

import { linkRoute } from "../sso/routes/link.route";
import { changePasswordRoute } from "./change-password.route";
import { resetPasswordRoute } from "./reset-passowrd.route";
import { signInRoute } from "./sign-in.route";
import { signUpRoute } from "./sign-up.route";

const authorization = (
  enabled: boolean,
): EnvVariablesVitNode["core"]["authorization"] => ({
  adminCookieExpires: 1000 * 60 * 60 * 24,
  adminCookieName: "vitnode_auth_admin",
  cookieDomain: undefined,
  cookie_expires: 1000 * 60 * 60 * 24 * 90,
  cookieName: "vitnode_auth",
  cookieSecure: true,
  deviceCookieExpires: 1000 * 60 * 60 * 24 * 365,
  deviceCookieName: "vitnode_device",
  passkeys: { enabled: false, problems: [] },
  password: { enabled },
  ssoAdapters: [],
});

const STORED_PASSWORD = await new PasswordModel().encryptPassword("Test123!");

const fakeDb = () => {
  const selects = vi.fn();
  const rows = [{ email: "test@test.com", id: 1, password: STORED_PASSWORD }];
  const chain = {
    from: () => chain,
    limit: () => chain,
    then: async (onFulfilled: (value: typeof rows) => unknown) =>
      await Promise.resolve(onFulfilled(rows)),
    where: () => chain,
  };

  return {
    db: {
      select: () => {
        selects();

        return chain;
      },
    },
    selects,
  };
};

const appWithPassword = (enabled: boolean) => {
  const { db, selects } = fakeDb();
  const createSession = vi
    .spyOn(SessionModel.prototype, "createSessionByUserId")
    .mockResolvedValue({ token: "session-token" });
  const createAdminSession = vi
    .spyOn(SessionAdminModel.prototype, "createSessionByUserId")
    .mockResolvedValue({ token: "admin-token" });

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("core", {
      authorization: authorization(enabled),
    } as EnvVariablesVitNode["core"]);
    c.set("user", null as Context["var"]["user"]);
    c.set("db", db as unknown as Context["var"]["db"]);
    await next();
  });
  for (const built of [
    signInRoute,
    signUpRoute,
    resetPasswordRoute,
    changePasswordRoute,
  ]) {
    app.openapi(built.route, built.handler);
  }
  const sso = new OpenAPIHono();
  sso.openapi(linkRoute.route, linkRoute.handler);
  app.route("/sso", sso);

  return { app, createAdminSession, createSession, selects };
};

const post = (body: unknown): RequestInit => ({
  body: JSON.stringify(body),
  headers: { "content-type": "application/json" },
  method: "POST",
});

const CREDENTIALS = { email: "test@test.com", password: "Test123!" };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("authorization.password switched off", () => {
  it("refuses a public password sign-in without checking the password", async () => {
    const { app, createSession, selects } = appWithPassword(false);

    const response = await app.request("/sign_in", post(CREDENTIALS));

    expect(response.status).toBe(403);
    expect(selects).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("still lets staff sign in to the AdminCP", async () => {
    const { app, createAdminSession } = appWithPassword(false);

    const response = await app.request(
      "/sign_in",
      post({ ...CREDENTIALS, isAdmin: true }),
    );

    expect(response.status).toBe(201);
    expect(createAdminSession).toHaveBeenCalledWith(1);
  });

  it("refuses sign-up, password reset, password change and password-based SSO linking", async () => {
    const { app } = appWithPassword(false);

    const responses = await Promise.all([
      app.request(
        "/sign_up",
        post({ ...CREDENTIALS, name: "tester", newsletter: false }),
      ),
      app.request("/reset-password", post({ email: CREDENTIALS.email })),
      app.request(
        "/change-password",
        post({
          password: "NewPassword1!",
          token: "a".repeat(32),
          userId: 1,
        }),
      ),
      app.request(
        "/sso/google/link",
        post({ password: CREDENTIALS.password, token: "t".repeat(32) }),
      ),
    ]);

    expect(responses.map(response => response.status)).toEqual([
      403, 403, 403, 403,
    ]);
  });
});

describe("authorization.password on (the default)", () => {
  it("signs a member in with their password", async () => {
    const { app, createSession, selects } = appWithPassword(true);

    const response = await app.request("/sign_in", post(CREDENTIALS));

    expect(response.status).toBe(201);
    expect(selects).toHaveBeenCalledOnce();
    expect(createSession).toHaveBeenCalledWith(1);
  });
});
