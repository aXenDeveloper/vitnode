import { describe, expect, it, vi } from "vitest";

import { signInFormOutcome } from "@/views/auth/sign-in/form/schema";

import type { AuthApiRequester } from "./transport-operations";

import {
  adminPasskeySignInResultFromStatus,
  passkeySignInResultFromStatus,
  signInResultFromStatus,
  verifyEmailResultFromStatus,
} from "./contract";
import { confirmEmailResult, signInFormResult } from "./screens";
import { createAuthOperations } from "./transport-operations";
import {
  emailVerificationAvailability,
  normalizeVerifyEmailSearch,
  verifyEmailMode,
} from "./verify-email";

const NOT_VERIFIED = { error: "email_not_verified" };
const LINK = "confirm-token-confirm-token-confirm-token";

describe("a sign-in refused because the address is unconfirmed", () => {
  it("is told apart from wrong credentials by its body", () => {
    expect(signInResultFromStatus(403, NOT_VERIFIED)).toEqual({
      ok: false,
      reason: "email_not_verified",
    });
    expect(signInResultFromStatus(403, "Forbidden")).toEqual({
      ok: false,
      reason: "access_denied",
    });
  });

  it("is shown in the form, where the resend link lives", () => {
    const result = signInFormResult({
      ok: false,
      reason: "email_not_verified",
    });

    expect(result).toEqual({ message: "email_not_verified" });
    expect(signInFormOutcome(result)).toEqual({
      error: "email_not_verified",
      kind: "field",
    });
  });

  it("is told apart for a public passkey sign-in, but not the AdminCP one", () => {
    expect(passkeySignInResultFromStatus(403, NOT_VERIFIED)).toEqual({
      ok: false,
      reason: "email_not_verified",
    });
    expect(adminPasskeySignInResultFromStatus(403, NOT_VERIFIED)).toEqual({
      ok: false,
      reason: "access_denied",
    });
  });
});

const unreachable = () => {
  throw new Error("not part of this suite");
};

const requester = (
  overrides: Partial<AuthApiRequester<unknown>>,
): AuthApiRequester<unknown> => ({
  changePasswordFromReset: unreachable,
  completeSso: unreachable,
  finishAdminPasskeySignIn: unreachable,
  finishPasskeySignIn: unreachable,
  linkSso: unreachable,
  readSession: unreachable,
  requestPasswordReset: unreachable,
  resendEmailVerification: unreachable,
  signIn: unreachable,
  signOut: unreachable,
  signUp: unreachable,
  startAdminPasskeySignIn: unreachable,
  startPasskeySignIn: unreachable,
  startSso: unreachable,
  verifyEmail: unreachable,
  ...overrides,
});

const answer = (status: number, body: unknown) => ({
  json: async () => Promise.resolve(body),
  status,
});

describe("the auth operations", () => {
  it("read the refusal body of a password sign-in", async () => {
    const operations = createAuthOperations(
      requester({
        signIn: async () => Promise.resolve(answer(403, NOT_VERIFIED)),
      }),
    );

    expect(
      await operations.signIn({ email: "a@b.com", password: "x" }),
    ).toEqual({ ok: false, reason: "email_not_verified" });
  });

  it("send the link's token and read back the confirmed address", async () => {
    const verifyEmail = vi.fn(async () =>
      Promise.resolve(answer(200, { email: "a@b.com" })),
    );
    const operations = createAuthOperations(requester({ verifyEmail }));

    expect(await operations.verifyEmail({ token: LINK })).toEqual({
      email: "a@b.com",
      ok: true,
    });
    expect(verifyEmail).toHaveBeenCalledWith({ token: LINK });
  });

  it("answer a resend the same way whatever the address", async () => {
    const operations = createAuthOperations(
      requester({
        resendEmailVerification: async () => Promise.resolve({ status: 201 }),
      }),
    );

    expect(
      await operations.resendEmailVerification({
        captchaToken: "",
        email: "a@b.com",
      }),
    ).toEqual({ ok: true });
  });
});

describe("confirming a link", () => {
  it("maps the API's answers onto what the screen shows", () => {
    expect(confirmEmailResult(verifyEmailResultFromStatus(400))).toEqual({
      kind: "invalid_token",
    });
    expect(confirmEmailResult(verifyEmailResultFromStatus(500))).toEqual({
      kind: "error",
    });
    expect(
      confirmEmailResult(
        verifyEmailResultFromStatus(200, { email: "a@b.com" }),
      ),
    ).toEqual({ email: "a@b.com", kind: "confirmed" });
  });

  it("treats a 200 without the documented body as a failure", () => {
    expect(verifyEmailResultFromStatus(200, {})).toEqual({
      ok: false,
      reason: "server_error",
    });
  });
});

describe("the verify-email URL", () => {
  it("offers the confirm button for a usable link", () => {
    expect(
      verifyEmailMode(normalizeVerifyEmailSearch({ token: LINK })),
    ).toEqual({ mode: "confirm", token: LINK });
  });

  it("offers the resend form without a link, or with one that cannot be valid", () => {
    for (const token of [undefined, "", "short", `${LINK}<script>`]) {
      expect(verifyEmailMode(normalizeVerifyEmailSearch({ token }))).toEqual({
        mode: "resend",
      });
    }
  });

  it("exists only on an install that can send email", () => {
    expect(
      emailVerificationAvailability({ isEmail: true, isKnown: true }),
    ).toBe("available");
    expect(
      emailVerificationAvailability({ isEmail: false, isKnown: true }),
    ).toBe("disabled");
    expect(
      emailVerificationAvailability({ isEmail: false, isKnown: false }),
    ).toBe("unknown");
  });
});
