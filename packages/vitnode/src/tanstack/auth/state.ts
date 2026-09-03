import type { SessionApi } from "./session-api";

export type AuthUser = NonNullable<SessionApi["user"]>;

export type AuthState =
  | {
      isAdmin: boolean;
      isAuthenticated: true;
      session: SessionApi;
      user: AuthUser;
    }
  | {
      isAdmin: false;
      isAuthenticated: false;
      session: SessionApi;
      user: null;
    };

export const SESSION_QUERY_KEY = ["vitnode", "session"] as const;

export const authStateFromSession = (session: SessionApi): AuthState => {
  const { user } = session;

  if (!user) {
    return { isAdmin: false, isAuthenticated: false, session, user: null };
  }

  return { isAdmin: user.isAdmin, isAuthenticated: true, session, user };
};

export type AuthenticatedState = Extract<AuthState, { isAuthenticated: true }>;

export const canAccessAuthenticatedRoute = (
  auth: AuthState,
): auth is AuthenticatedState => auth.isAuthenticated;

export const canAccessGuestRoute = (auth: AuthState): boolean =>
  !auth.isAuthenticated;

export const canAccessAdminRoute = (auth: AuthState): boolean => auth.isAdmin;
