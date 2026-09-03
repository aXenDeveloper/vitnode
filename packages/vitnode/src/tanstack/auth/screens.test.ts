import { describe, expect, it } from "vitest";

import type { SessionApi } from "./session-api";

import {
  anonymousSession,
  signInFormResult,
  ssoCallbackResult,
  ssoStartFeedback,
} from "./screens";

describe("signInFormResult", () => {
  it("says nothing on success, which is how the shared form knows to stand down", () => {
    expect(signInFormResult({ ok: true })).toBeUndefined();
  });

  it("renders a denial in the form", () => {
    expect(signInFormResult({ ok: false, reason: "access_denied" })).toEqual({
      message: "access_denied",
    });
  });

  it("renders anything else as the internal-error toast", () => {
    expect(signInFormResult({ ok: false, reason: "server_error" })).toEqual({
      message: "Internal Server Error",
    });
  });
});

describe("ssoStartFeedback", () => {
  it("says nothing on success - the caller has a browser to send to the provider", () => {
    expect(
      ssoStartFeedback({
        ok: true,
        url: "https://accounts.google.com/o/oauth2",
      }),
    ).toBeUndefined();
  });

  it.each(["server_error", "unknown_provider"] as const)(
    "asks the button row for a toast on %s",
    reason => {
      expect(ssoStartFeedback({ ok: false, reason })).toEqual({
        message: reason,
      });
    },
  );
});

describe("ssoCallbackResult", () => {
  it("reports no failure on success", () => {
    expect(ssoCallbackResult({ ok: true })).toEqual({});
  });

  it("keeps the one failure a visitor can act on", () => {
    expect(ssoCallbackResult({ ok: false, reason: "email_exists" })).toEqual({
      failure: "email_exists",
    });
  });

  it.each(["invalid_state", "server_error", "unknown_provider"] as const)(
    "collapses %s, which a visitor cannot act on differently",
    reason => {
      expect(ssoCallbackResult({ ok: false, reason })).toEqual({
        failure: "unknown",
      });
    },
  );
});

describe("anonymousSession", () => {
  const session = {
    ai: { models: ["anthropic:claude-sonnet-5"] },
    user: { email: "test@test.com", id: 1, name: "Test" },
  } as unknown as SessionApi;

  it("removes the visitor", () => {
    expect(anonymousSession(session).user).toBeNull();
  });

  it("keeps everything that describes the installation rather than the visitor", () => {
    expect(anonymousSession(session).ai).toEqual(session.ai);
  });

  it("does not mutate the session it was given", () => {
    anonymousSession(session);

    expect(session.user).not.toBeNull();
  });
});
