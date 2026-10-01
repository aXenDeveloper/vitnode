import { describe, expect, it, vi } from "vitest";

import { ssoConnectionCallbackTarget } from "./connection-callback";

const STATE = `cl_${"a".repeat(64)}`;

describe("where a settings round trip lands", () => {
  it("reports a connected account", async () => {
    const complete = vi.fn(async () =>
      Promise.resolve({ intent: "link" as const, ok: true as const }),
    );

    expect(
      await ssoConnectionCallbackTarget({
        complete,
        providerId: "google",
        search: { code: "c", state: STATE },
      }),
    ).toEqual({ connected: "google" });
    expect(complete).toHaveBeenCalledWith({
      code: "c",
      providerId: "google",
      state: STATE,
    });
  });

  it("opens the import preview after an import round trip", async () => {
    expect(
      await ssoConnectionCallbackTarget({
        complete: async () =>
          Promise.resolve({ intent: "import" as const, ok: true as const }),
        providerId: "google",
        search: { code: "c", state: STATE },
      }),
    ).toEqual({ import: "google" });
  });

  it("reports what a sync changed, without leaving settings", async () => {
    expect(
      await ssoConnectionCallbackTarget({
        complete: async () =>
          Promise.resolve({
            intent: "sync" as const,
            ok: true as const,
            results: {
              avatar: "failed" as const,
              firstName: "updated" as const,
            },
          }),
        providerId: "google",
        search: { code: "c", state: `cs_${"a".repeat(64)}` },
      }),
    ).toEqual({
      results: { avatar: "failed", firstName: "updated" },
      synced: "google",
    });
  });

  it("carries the API's refusal back to settings", async () => {
    expect(
      await ssoConnectionCallbackTarget({
        complete: async () =>
          Promise.resolve({
            failure: "account_taken" as const,
            ok: false as const,
          }),
        providerId: "google",
        search: { code: "c", state: STATE },
      }),
    ).toEqual({ error: "account_taken", provider: "google" });
  });

  it("never calls the API when the provider refused or sent nothing back", async () => {
    const complete = vi.fn();

    expect(
      await ssoConnectionCallbackTarget({
        complete,
        providerId: "google",
        search: { error: "access_denied", state: STATE },
      }),
    ).toEqual({ error: "access_denied", provider: "google" });
    expect(
      await ssoConnectionCallbackTarget({
        complete,
        providerId: "google",
        search: { state: STATE },
      }),
    ).toEqual({ error: "invalid_state", provider: "google" });
    expect(complete).not.toHaveBeenCalled();
  });
});
