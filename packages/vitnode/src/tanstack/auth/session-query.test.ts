import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";

import type { SessionApi } from "./session-api";

import {
  ensureAuthState,
  invalidateSession,
  sessionQueryOptions,
} from "./session-query";
import { SESSION_QUERY_KEY } from "./state";
import { setAuthTransport } from "./transport";

let nextSession: SessionApi = { user: null } as SessionApi;
let nextFailure: Error | null = null;
let reads = 0;

const unreachable = () => {
  throw new Error("the session query calls no mutation");
};

setAuthTransport({
  changePasswordFromReset: unreachable,
  completeSso: unreachable,
  readSession: async () => {
    reads += 1;

    if (nextFailure) return await Promise.reject(nextFailure);

    return await Promise.resolve(nextSession);
  },
  requestPasswordReset: unreachable,
  signIn: unreachable,
  signOut: unreachable,
  signUp: unreachable,
  startSso: unreachable,
});

const anonymous = { user: null } as SessionApi;
const signedIn = {
  user: { id: 42, isAdmin: false, name: "Test" },
} as SessionApi;

beforeEach(() => {
  nextSession = anonymous;
  nextFailure = null;
  reads = 0;
});

describe("the canonical session query", () => {
  it("asks once and lets the failure surface", () => {
    expect(sessionQueryOptions().retry).toBe(false);
  });

  it("is the one entry every guard and component reads", () => {
    expect(sessionQueryOptions().queryKey).toEqual(SESSION_QUERY_KEY);
  });
});

describe("a guard reads the session again once it has been invalidated", () => {
  it("reads once when nothing is cached", async () => {
    const queryClient = new QueryClient();

    await ensureAuthState(queryClient);

    expect(reads).toBe(1);
  });

  it("does not read again inside the stale window", async () => {
    // The preload property `SESSION_STALE_TIME` exists for: the router runs
    // `defaultPreload: 'intent'`, so hovering a guarded link runs its
    // `beforeLoad`, and that must not cost a round trip per hover.
    const queryClient = new QueryClient();

    await ensureAuthState(queryClient);
    await ensureAuthState(queryClient);
    await ensureAuthState(queryClient);

    expect(reads).toBe(1);
  });

  it("reads again after an invalidation, with nothing observing the entry", async () => {
    const queryClient = new QueryClient();

    await ensureAuthState(queryClient);
    await invalidateSession(queryClient);
    await ensureAuthState(queryClient);

    expect(reads).toBe(2);
  });

  it("answers with the new visitor rather than the cached one", async () => {
    // The sign-in flow, in the order `useSignInAction` performs it: the API has
    // set the cookie, the entry is invalidated, and only then does the router
    // move. A guard at the destination must decide on the new session.
    const queryClient = new QueryClient();

    const before = await ensureAuthState(queryClient);
    expect(before.isAuthenticated).toBe(false);

    nextSession = signedIn;
    await invalidateSession(queryClient);

    const after = await ensureAuthState(queryClient);
    expect(after.isAuthenticated).toBe(true);
    expect(after.user?.id).toBe(42);
  });

  it("would not have, through ensureQueryData", async () => {
    // The control, and the reason this suite exists. Without it every assertion
    // above would pass on the implementation that had the bug - `ensureAuthState`
    // could go back to `ensureQueryData` and only this fails.
    const queryClient = new QueryClient();

    await queryClient.ensureQueryData(sessionQueryOptions());
    nextSession = signedIn;
    await invalidateSession(queryClient);

    const stale = await queryClient.ensureQueryData(sessionQueryOptions());

    expect(reads).toBe(1);
    expect(stale.user).toBeNull();
  });

  it("rejects rather than answering when the session cannot be read", async () => {
    // `fetchQuery` propagates, where `prefetchQuery` swallows. A guard must not
    // be handed a stale answer during an outage - `_authenticated` leaves the
    // rejection to the router's error path rather than signing anybody out.
    const queryClient = new QueryClient();

    nextFailure = new Error("the session could not be read");

    await expect(ensureAuthState(queryClient)).rejects.toThrow(
      "the session could not be read",
    );
  });
});
