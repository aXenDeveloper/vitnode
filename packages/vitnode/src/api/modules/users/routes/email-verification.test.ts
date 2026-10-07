// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EnvVariablesVitNode } from "@/api/middlewares/global.middleware";

import {
  EMAIL_VERIFICATION_TTL_MS,
  EmailVerificationModel,
} from "@/api/models/email-verification";
import { ForgotPasswordTokenModel, PasswordModel } from "@/api/models/password";
import { SessionModel } from "@/api/models/session";
import { SessionAdminModel } from "@/api/models/session-admin";
import { core_admin_sessions } from "@/database/admins";
import { core_roles } from "@/database/roles";
import { core_sessions } from "@/database/sessions";
import {
  core_users,
  core_users_confirm_emails,
  core_users_forgot_password,
} from "@/database/users";
import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";
import { SESSION_AUTHORIZATION } from "@/tests/sessions";

import { changePasswordRoute } from "./change-password.route";
import { resendVerificationRoute } from "./resend-verification.route";
import { resetPasswordRoute } from "./reset-passowrd.route";
import { signInRoute } from "./sign-in.route";
import { signUpRoute } from "./sign-up.route";
import { verifyEmailRoute } from "./verify-email.route";

const PASSWORD = "Test123!";
const STORED_PASSWORD = await new PasswordModel().encryptPassword(PASSWORD);
const LINK_TOKEN = "confirm-token-confirm-token-confirm-token";
const sha256 = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

interface MemberSeed {
  email: string;
  emailVerified: boolean;
  id: number;
}

const member = ({ email, emailVerified, id }: MemberSeed) => ({
  avatarColor: "aaaaaa",
  email,
  emailVerified,
  id,
  ipAddress: "203.0.113.7",
  language: "en",
  name: `member-${id}`,
  nameCode: `member-${id}`,
  password: STORED_PASSWORD,
  roleId: 2,
});

const UNVERIFIED = { email: "new@example.com", emailVerified: false, id: 7 };
const VERIFIED = { email: "old@example.com", emailVerified: true, id: 8 };

const harness = ({
  confirmations = [],
  members = [UNVERIFIED, VERIFIED],
  resets = [],
  withEmail = true,
}: {
  confirmations?: Record<string, unknown>[];
  members?: MemberSeed[];
  resets?: Record<string, unknown>[];
  withEmail?: boolean;
} = {}) => {
  const memory = createMemoryDb([
    [
      core_roles,
      [
        { default: false, id: 1, root: true },
        { default: true, id: 2, root: false },
      ],
    ],
    [core_users, members.map(member)],
    [core_users_confirm_emails, confirmations],
    [core_users_forgot_password, resets],
    [core_sessions, []],
    [core_admin_sessions, []],
  ]);
  const send = vi.fn(async () => Promise.resolve());
  const emit = vi.fn(async () => Promise.resolve(undefined));
  const logError = vi.fn(async () => Promise.resolve());
  const createSession = vi
    .spyOn(SessionModel.prototype, "createSessionByUserId")
    .mockResolvedValue({ token: "session-token" });
  const createAdminSession = vi
    .spyOn(SessionAdminModel.prototype, "createSessionByUserId")
    .mockResolvedValue({ token: "admin-token" });
  vi.spyOn(EmailVerificationModel.prototype, "generateToken").mockReturnValue(
    LINK_TOKEN,
  );

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("core", {
      authorization: SESSION_AUTHORIZATION,
      email: withEmail ? { adapter: { sendEmail: vi.fn() } } : undefined,
    } as unknown as EnvVariablesVitNode["core"]);
    c.set("cache", createTestCache());
    c.set("db", memory.db as unknown as Context["var"]["db"]);
    c.set("email", { send } as unknown as Context["var"]["email"]);
    c.set("events", { emit } as unknown as Context["var"]["events"]);
    c.set("ipAddress", "203.0.113.7");
    c.set("log", { error: logError } as unknown as Context["var"]["log"]);
    c.set("user", null as Context["var"]["user"]);
    await next();
  });
  for (const built of [
    changePasswordRoute,
    resendVerificationRoute,
    resetPasswordRoute,
    signInRoute,
    signUpRoute,
    verifyEmailRoute,
  ]) {
    app.openapi(built.route, built.handler);
  }

  const post = async (path: string, body: unknown) =>
    await app.request(path, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

  const userRow = (id: number) =>
    memory.rows(core_users).find(row => row.id === id);
  const confirmationRows = () => memory.rows(core_users_confirm_emails);

  return {
    confirmationRows,
    createAdminSession,
    createSession,
    emit,
    logError,
    post,
    send,
    userRow,
  };
};

const pendingLink = (overrides: Record<string, unknown> = {}) => ({
  createdAt: new Date(Date.now() - 1000 * 60 * 60),
  expiresAt: new Date(Date.now() + 1000 * 60 * 60),
  id: 1,
  ipAddress: "203.0.113.7",
  token: sha256(LINK_TOKEN),
  userId: UNVERIFIED.id,
  ...overrides,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("signing up on an install that sends email", () => {
  const SIGN_UP = {
    email: "fresh@example.com",
    name: "fresh",
    password: PASSWORD,
  };

  it("emails a confirmation link instead of signing the member in", async () => {
    const h = harness({ members: [VERIFIED] });

    const response = await h.post("/sign_up", SIGN_UP);

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      email: SIGN_UP.email,
      emailVerified: false,
    });
    expect(h.createSession).not.toHaveBeenCalled();
    expect(h.send).toHaveBeenCalledOnce();
    expect(h.send).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ email: SIGN_UP.email }),
      }),
    );
  });

  it("stores only a digest of the link, valid for a day", async () => {
    const h = harness({ members: [VERIFIED] });

    await h.post("/sign_up", SIGN_UP);

    const [row] = h.confirmationRows();
    expect(row?.token).toBe(sha256(LINK_TOKEN));
    expect(row?.token).not.toBe(LINK_TOKEN);
    const expiresIn = (row?.expiresAt as Date).getTime() - Date.now();
    expect(expiresIn).toBeGreaterThan(EMAIL_VERIFICATION_TTL_MS - 60_000);
    expect(expiresIn).toBeLessThanOrEqual(EMAIL_VERIFICATION_TTL_MS);
  });

  it("still creates the account when the link could not be sent", async () => {
    const h = harness({ members: [VERIFIED] });
    h.send.mockRejectedValueOnce(new Error("smtp down"));

    const response = await h.post("/sign_up", SIGN_UP);

    expect(response.status).toBe(201);
    expect(h.logError).toHaveBeenCalledOnce();
  });

  it("signs the member straight in when the install cannot send email", async () => {
    const h = harness({ members: [VERIFIED], withEmail: false });

    const response = await h.post("/sign_up", SIGN_UP);

    expect(await response.json()).toMatchObject({ emailVerified: true });
    expect(h.createSession).toHaveBeenCalledOnce();
    expect(h.send).not.toHaveBeenCalled();
  });
});

describe("signing in before the address is confirmed", () => {
  it("refuses the right password with email_not_verified", async () => {
    const h = harness();

    const response = await h.post("/sign_in", {
      email: UNVERIFIED.email,
      password: PASSWORD,
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "email_not_verified" });
    expect(h.createSession).not.toHaveBeenCalled();
  });

  it("answers a wrong password exactly like an unknown address", async () => {
    const h = harness();

    const wrongPassword = await h.post("/sign_in", {
      email: UNVERIFIED.email,
      password: "Wrong123!",
    });
    const unknown = await h.post("/sign_in", {
      email: "nobody@example.com",
      password: "Wrong123!",
    });

    expect(wrongPassword.status).toBe(403);
    expect(unknown.status).toBe(403);
    expect(await wrongPassword.text()).toBe(await unknown.text());
  });

  it("proves the password before saying anything about the address", async () => {
    const h = harness();
    const verify = vi.spyOn(PasswordModel.prototype, "verifyPassword");

    await h.post("/sign_in", { email: UNVERIFIED.email, password: PASSWORD });

    expect(verify).toHaveBeenCalledWith(PASSWORD, STORED_PASSWORD);
  });

  it("lets the same member in once the install no longer sends email", async () => {
    const h = harness({ withEmail: false });

    const response = await h.post("/sign_in", {
      email: UNVERIFIED.email,
      password: PASSWORD,
    });

    expect(response.status).toBe(201);
    expect(h.createSession).toHaveBeenCalledWith(UNVERIFIED.id);
  });

  it("does not hold up the AdminCP sign-in, which only admits staff", async () => {
    const h = harness();

    const response = await h.post("/sign_in", {
      email: UNVERIFIED.email,
      isAdmin: true,
      password: PASSWORD,
    });

    expect(response.status).toBe(201);
    expect(h.createAdminSession).toHaveBeenCalledWith(UNVERIFIED.id);
  });
});

describe("following the confirmation link", () => {
  it("confirms the address, spends the link and emits user.email.verified", async () => {
    const h = harness({ confirmations: [pendingLink()] });

    const response = await h.post("/verify-email", { token: LINK_TOKEN });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email: UNVERIFIED.email });
    expect(h.userRow(UNVERIFIED.id)?.emailVerified).toBe(true);
    expect(h.confirmationRows()).toEqual([]);
    expect(h.emit).toHaveBeenCalledWith("user.email.verified", {
      email: UNVERIFIED.email,
      userId: UNVERIFIED.id,
    });
  });

  it("does not sign anybody in - the member signs in with their password next", async () => {
    const h = harness({ confirmations: [pendingLink()] });

    const confirmed = await h.post("/verify-email", { token: LINK_TOKEN });
    const signIn = await h.post("/sign_in", {
      email: UNVERIFIED.email,
      password: PASSWORD,
    });

    expect(confirmed.headers.getSetCookie()).toEqual([]);
    expect(signIn.status).toBe(201);
    expect(h.createSession).toHaveBeenCalledOnce();
  });

  it("works exactly once", async () => {
    const h = harness({ confirmations: [pendingLink()] });

    const first = await h.post("/verify-email", { token: LINK_TOKEN });
    const second = await h.post("/verify-email", { token: LINK_TOKEN });

    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
    expect(h.emit).toHaveBeenCalledOnce();
  });

  it("refuses an expired link and leaves the account unconfirmed", async () => {
    const h = harness({
      confirmations: [pendingLink({ expiresAt: new Date(Date.now() - 1000) })],
    });

    const response = await h.post("/verify-email", { token: LINK_TOKEN });

    expect(response.status).toBe(400);
    expect(h.userRow(UNVERIFIED.id)?.emailVerified).toBe(false);
  });

  it("refuses a token that was never issued", async () => {
    const h = harness({ confirmations: [pendingLink()] });

    const response = await h.post("/verify-email", {
      token: "never-issued-never-issued-never-issued",
    });

    expect(response.status).toBe(400);
    expect(h.userRow(UNVERIFIED.id)?.emailVerified).toBe(false);
  });
});

describe("asking for a new confirmation link", () => {
  it("answers the same 201 for an unknown, a confirmed and an unconfirmed address", async () => {
    const h = harness();

    const responses = await Promise.all(
      ["nobody@example.com", VERIFIED.email, UNVERIFIED.email].map(
        async email => await h.post("/verify-email/resend", { email }),
      ),
    );

    expect(responses.map(response => response.status)).toEqual([201, 201, 201]);
    const bodies = await Promise.all(
      responses.map(async response => await response.text()),
    );
    expect(new Set(bodies).size).toBe(1);
  });

  it("only sends to an account that still needs confirming", async () => {
    const h = harness();

    await h.post("/verify-email/resend", { email: "nobody@example.com" });
    await h.post("/verify-email/resend", { email: VERIFIED.email });
    await h.post("/verify-email/resend", { email: UNVERIFIED.email });

    expect(h.send).toHaveBeenCalledOnce();
    expect(h.send).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: UNVERIFIED.id }),
      }),
    );
  });

  it("replaces the old link, so only the newest one confirms", async () => {
    const h = harness({
      confirmations: [
        pendingLink({ token: sha256("an-older-link-an-older-link") }),
      ],
    });

    await h.post("/verify-email/resend", { email: UNVERIFIED.email });

    expect(h.confirmationRows().map(row => row.token)).toEqual([
      sha256(LINK_TOKEN),
    ]);
    expect(
      (await h.post("/verify-email", { token: "an-older-link-an-older-link" }))
        .status,
    ).toBe(400);
  });

  it("sends nothing while a link from the last five minutes is still out", async () => {
    const h = harness({
      confirmations: [pendingLink({ createdAt: new Date() })],
    });

    const response = await h.post("/verify-email/resend", {
      email: UNVERIFIED.email,
    });

    expect(response.status).toBe(201);
    expect(h.send).not.toHaveBeenCalled();
  });

  it("answers 404 for every address on an install that cannot send email", async () => {
    const h = harness({ withEmail: false });

    const known = await h.post("/verify-email/resend", {
      email: UNVERIFIED.email,
    });
    const unknown = await h.post("/verify-email/resend", {
      email: "nobody@example.com",
    });

    expect([known.status, unknown.status]).toEqual([404, 404]);
    expect(await known.text()).toBe(await unknown.text());
  });
});

describe("completing a password reset", () => {
  const RESET_TOKEN = "reset-token-reset-token";
  const resetFor = (userId: number) => ({
    expiresAt: new Date(Date.now() + 1000 * 60 * 10),
    id: userId,
    ipAddress: "203.0.113.7",
    token: new ForgotPasswordTokenModel().hashResetToken(RESET_TOKEN),
    userId,
  });
  const changePassword = (userId: number) => ({
    password: "NewPassword1!",
    token: RESET_TOKEN,
    userId,
  });

  it("also confirms the address, since the reset link went to the same mailbox", async () => {
    const h = harness({ resets: [resetFor(UNVERIFIED.id)] });

    const response = await h.post(
      "/change-password",
      changePassword(UNVERIFIED.id),
    );

    expect(response.status).toBe(201);
    expect(h.userRow(UNVERIFIED.id)?.emailVerified).toBe(true);
    expect(h.emit).toHaveBeenCalledWith("user.email.verified", {
      email: UNVERIFIED.email,
      userId: UNVERIFIED.id,
    });
  });

  it("emits nothing about the address when it was already confirmed", async () => {
    const h = harness({ resets: [resetFor(VERIFIED.id)] });

    await h.post("/change-password", changePassword(VERIFIED.id));

    expect(h.emit).not.toHaveBeenCalledWith(
      "user.email.verified",
      expect.anything(),
    );
  });
});
