import { describe, expect, it } from "vitest";

import type { SessionApi } from "./session-api";
import type { AuthUser } from "./state";

import {
  authStateFromSession,
  canAccessAdminRoute,
  canAccessAuthenticatedRoute,
  canAccessGuestRoute,
  SESSION_QUERY_KEY,
} from "./state";

const anonymousSession: SessionApi = { ai: { models: [] }, user: null };

/** A signed-in visitor, exactly as `users/session.route.ts` describes one. */
const userFixture = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  avatarColor: "#101010",
  birthday: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  email: "test@test.com",
  emailVerified: true,
  id: 1,
  isAdmin: false,
  isModerator: false,
  name: "Test",
  nameCode: "test",
  newsletter: false,
  roleId: 1,
  ...overrides,
});

const sessionFor = (user: AuthUser): SessionApi => ({
  ai: { models: [] },
  user,
});

describe("a session becomes an auth state", () => {
  it("decides on the user and on nothing else", () => {
    // The union has two members and no third for "we could not find out", which
    // is why this is total: every session the API can answer with maps to one
    // of them, and everything else is an error before it gets here.
    expect(authStateFromSession(anonymousSession).isAuthenticated).toBe(false);
    expect(
      authStateFromSession(sessionFor(userFixture())).isAuthenticated,
    ).toBe(true);
  });

  it("reads a null user as a guest", () => {
    const auth = authStateFromSession(anonymousSession);

    expect(auth.isAuthenticated).toBe(false);
    expect(auth.isAdmin).toBe(false);
    expect(auth.user).toBeNull();
  });

  it("reads a user as authenticated, without copying them", () => {
    const user = userFixture();
    const session = sessionFor(user);
    const auth = authStateFromSession(session);

    expect(auth.isAuthenticated).toBe(true);
    // The same objects, not clones: a page reads the visitor and `ai.models`
    // off this state, and a copy is a second answer that can drift.
    expect(auth.user).toBe(user);
    expect(auth.session).toBe(session);
  });

  it("reads an admin as an admin", () => {
    const auth = authStateFromSession(
      sessionFor(userFixture({ isAdmin: true })),
    );

    expect(auth.isAuthenticated).toBe(true);
    expect(auth.isAdmin).toBe(true);
  });

  it("does not promote a moderator to anything", () => {
    const auth = authStateFromSession(
      sessionFor(userFixture({ isModerator: true })),
    );

    expect(auth.isAdmin).toBe(false);
    expect("isModerator" in auth).toBe(false);
  });

  it("answers the same session identically every time", () => {
    const session = sessionFor(userFixture({ isAdmin: true }));

    expect(authStateFromSession(session)).toEqual(
      authStateFromSession(session),
    );
    expect(authStateFromSession(anonymousSession)).toEqual(
      authStateFromSession(anonymousSession),
    );
  });
});

describe("the access predicates", () => {
  const guest = authStateFromSession(anonymousSession);
  const member = authStateFromSession(sessionFor(userFixture()));
  const admin = authStateFromSession(
    sessionFor(userFixture({ isAdmin: true })),
  );

  it("lets only a guest into a guest-only route", () => {
    expect(canAccessGuestRoute(guest)).toBe(true);
    expect(canAccessGuestRoute(member)).toBe(false);
    expect(canAccessGuestRoute(admin)).toBe(false);
  });

  it("lets only a signed-in visitor into an authenticated route", () => {
    expect(canAccessAuthenticatedRoute(guest)).toBe(false);
    expect(canAccessAuthenticatedRoute(member)).toBe(true);
    expect(canAccessAuthenticatedRoute(admin)).toBe(true);
  });

  it("lets only an admin into an admin route", () => {
    expect(canAccessAdminRoute(guest)).toBe(false);
    expect(canAccessAdminRoute(member)).toBe(false);
    expect(canAccessAdminRoute(admin)).toBe(true);
  });

  it("never opens both a guest route and an authenticated one", () => {
    for (const auth of [guest, member, admin]) {
      expect(canAccessGuestRoute(auth)).toBe(
        !canAccessAuthenticatedRoute(auth),
      );
    }
  });
});

describe("the session cache key", () => {
  it("is one stable entry", () => {
    expect(SESSION_QUERY_KEY).toEqual(["vitnode", "session"]);
  });

  it("carries no locale, and nothing else either", () => {
    const key: readonly string[] = SESSION_QUERY_KEY;

    expect(key).toHaveLength(2);
  });
});
