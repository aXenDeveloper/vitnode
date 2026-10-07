import { describe, expect, it, vi } from "vitest";

import type { AuthApiRequester } from "./transport-operations";

import { createAuthOperations } from "./transport-operations";

const OPTIONS = {
  challenge: "Y2hhbGxlbmdl",
  userVerification: "required" as const,
};

const RESPONSE = {
  clientExtensionResults: {},
  id: "Y3JlZA",
  rawId: "Y3JlZA",
  response: {
    authenticatorData: "ZGF0YQ",
    clientDataJSON: "Y2xpZW50",
    signature: "c2ln",
  },
  type: "public-key" as const,
};

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

const answer = <TBody>(status: number, body: TBody) => ({
  json: async () => Promise.resolve(body),
  status,
});

describe("AdminCP passkey sign-in operations", () => {
  it("starts on the AdminCP route, not the public one", async () => {
    const startAdminPasskeySignIn = vi.fn(async () =>
      Promise.resolve(answer(200, OPTIONS)),
    );
    const operations = createAuthOperations(
      requester({ startAdminPasskeySignIn }),
    );

    expect(await operations.startAdminPasskeySignIn()).toEqual({
      ok: true,
      options: OPTIONS,
    });
    expect(startAdminPasskeySignIn).toHaveBeenCalledOnce();
  });

  it("reads the refusal body to tell a missing staff grant apart", async () => {
    const operations = createAuthOperations(
      requester({
        finishAdminPasskeySignIn: async () =>
          Promise.resolve(answer(403, { error: "not_staff" })),
      }),
    );

    expect(
      await operations.finishAdminPasskeySignIn({ response: RESPONSE }),
    ).toEqual({ ok: false, reason: "not_staff" });
  });

  it("answers server_error instead of throwing when the API is unreachable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const operations = createAuthOperations(
      requester({
        finishAdminPasskeySignIn: async () =>
          Promise.reject(new Error("offline")),
        startAdminPasskeySignIn: async () =>
          Promise.reject(new Error("offline")),
      }),
    );

    expect(await operations.startAdminPasskeySignIn()).toEqual({
      ok: false,
      reason: "server_error",
    });
    expect(
      await operations.finishAdminPasskeySignIn({ response: RESPONSE }),
    ).toEqual({ ok: false, reason: "server_error" });
  });
});
