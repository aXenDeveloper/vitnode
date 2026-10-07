// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EnvVariablesVitNode } from "@/api/middlewares/global.middleware";

import { PasswordModel } from "@/api/models/password";
import { SessionModel } from "@/api/models/session";
import { SessionAdminModel } from "@/api/models/session-admin";
import { SSOModel } from "@/api/models/sso";
import { core_roles } from "@/database/roles";
import { core_users, core_users_forgot_password } from "@/database/users";
import { createMemoryDb } from "@/tests/memory-db";
import { SESSION_AUTHORIZATION } from "@/tests/sessions";

import {
  USER_EMAIL_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
  USER_PASSWORD_MAX_LENGTH,
} from "../credential-limits";
import { linkRoute } from "../sso/routes/link.route";
import { changePasswordRoute } from "./change-password.route";
import { resetPasswordRoute } from "./reset-passowrd.route";
import { signInRoute } from "./sign-in.route";
import { signUpRoute } from "./sign-up.route";

const PASSWORD = "Test123!";
const STORED_PASSWORD = await new PasswordModel().encryptPassword(PASSWORD);
const MEMBER = {
  avatarColor: "aaaaaa",
  email: "test@test.com",
  emailVerified: true,
  id: 1,
  ipAddress: "203.0.113.7",
  language: "en",
  name: "tester",
  nameCode: "tester",
  password: STORED_PASSWORD,
  roleId: 2,
};

const harness = ({ withEmail = true }: { withEmail?: boolean } = {}) => {
  const memory = createMemoryDb([
    [
      core_roles,
      [
        { default: false, id: 1, root: true },
        { default: true, id: 2, root: false },
      ],
    ],
    [core_users, [MEMBER]],
    [core_users_forgot_password, []],
  ]);
  const send = vi.fn(async () => Promise.resolve());
  vi.spyOn(SessionModel.prototype, "createSessionByUserId").mockResolvedValue({
    token: "session-token",
  });
  vi.spyOn(
    SessionAdminModel.prototype,
    "createSessionByUserId",
  ).mockResolvedValue({ token: "admin-token" });

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("core", {
      authorization: SESSION_AUTHORIZATION,
      email: withEmail ? { adapter: { sendEmail: vi.fn() } } : undefined,
    } as unknown as EnvVariablesVitNode["core"]);
    c.set("db", memory.db as unknown as Context["var"]["db"]);
    c.set("email", { send } as unknown as Context["var"]["email"]);
    c.set("events", {
      emit: vi.fn(async () => Promise.resolve(undefined)),
    } as unknown as Context["var"]["events"]);
    c.set("ipAddress", "203.0.113.7");
    c.set("user", null as Context["var"]["user"]);
    await next();
  });
  for (const built of [
    changePasswordRoute,
    resetPasswordRoute,
    signInRoute,
    signUpRoute,
  ]) {
    app.openapi(built.route, built.handler);
  }
  const sso = new OpenAPIHono();
  sso.openapi(linkRoute.route, linkRoute.handler);
  app.route("/sso", sso);

  const post = async (path: string, body: unknown) =>
    await app.request(path, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

  return { post, send };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the session token stays in its HttpOnly cookie", () => {
  it("is not in a member's sign-in answer", async () => {
    const h = harness();

    const response = await h.post("/sign_in", {
      email: MEMBER.email,
      password: PASSWORD,
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: MEMBER.id });
  });

  it("is not in an AdminCP sign-in answer", async () => {
    const h = harness();

    const response = await h.post("/sign_in", {
      email: MEMBER.email,
      isAdmin: true,
      password: PASSWORD,
    });

    expect(await response.json()).toEqual({ id: MEMBER.id });
  });

  it("is not in the answer to linking an SSO identity", async () => {
    const h = harness();
    vi.spyOn(SSOModel.prototype, "link").mockResolvedValue({
      userId: MEMBER.id,
    });

    const response = await h.post("/sso/google/link", {
      password: PASSWORD,
      token: "t".repeat(32),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: MEMBER.id });
  });
});

describe("a password reset request says nothing about the address", () => {
  it("answers a registered and an unknown address the same way without email", async () => {
    const h = harness({ withEmail: false });

    const known = await h.post("/reset-password", { email: MEMBER.email });
    const unknown = await h.post("/reset-password", {
      email: "nobody@example.com",
    });

    expect([known.status, unknown.status]).toEqual([404, 404]);
    expect(await known.text()).toBe(await unknown.text());
  });

  it("answers a registered and an unknown address the same way with email", async () => {
    const h = harness();

    const known = await h.post("/reset-password", { email: MEMBER.email });
    const unknown = await h.post("/reset-password", {
      email: "nobody@example.com",
    });

    expect([known.status, unknown.status]).toEqual([201, 201]);
    expect(await known.text()).toBe(await unknown.text());
    expect(h.send).toHaveBeenCalledOnce();
  });
});

describe("credential length limits", () => {
  const tooLongPassword = "A1!".padEnd(USER_PASSWORD_MAX_LENGTH + 1, "a");
  const tooLongEmail = `${"a".repeat(USER_EMAIL_MAX_LENGTH)}@example.com`;

  it("refuses an oversized sign-in password before hashing anything", async () => {
    const h = harness();
    const verify = vi.spyOn(PasswordModel.prototype, "verifyPassword");

    const response = await h.post("/sign_in", {
      email: MEMBER.email,
      password: tooLongPassword,
    });

    expect(response.status).toBe(400);
    expect(verify).not.toHaveBeenCalled();
  });

  it("still checks a password right at the limit", async () => {
    const h = harness();

    const response = await h.post("/sign_in", {
      email: MEMBER.email,
      password: "a".repeat(USER_PASSWORD_MAX_LENGTH),
    });

    expect(response.status).toBe(403);
  });

  it("refuses an oversized sign-in email", async () => {
    const h = harness();

    const response = await h.post("/sign_in", {
      email: tooLongEmail,
      password: PASSWORD,
    });

    expect(response.status).toBe(400);
  });

  it.each([
    ["name", { name: "n".repeat(USER_NAME_MAX_LENGTH + 1) }],
    ["email", { email: tooLongEmail }],
    ["password", { password: tooLongPassword }],
  ])("refuses a sign-up with an oversized %s", async (_field, override) => {
    const h = harness();
    const encrypt = vi.spyOn(PasswordModel.prototype, "encryptPassword");

    const response = await h.post("/sign_up", {
      email: "fresh@example.com",
      name: "fresh",
      password: PASSWORD,
      ...override,
    });

    expect(response.status).toBe(400);
    expect(encrypt).not.toHaveBeenCalled();
  });

  it("refuses an oversized new password from a reset link", async () => {
    const h = harness();

    const response = await h.post("/change-password", {
      password: tooLongPassword,
      token: "a".repeat(32),
      userId: MEMBER.id,
    });

    expect(response.status).toBe(400);
  });

  it("refuses an oversized address in a reset request", async () => {
    const h = harness();

    const response = await h.post("/reset-password", { email: tooLongEmail });

    expect(response.status).toBe(400);
  });
});
