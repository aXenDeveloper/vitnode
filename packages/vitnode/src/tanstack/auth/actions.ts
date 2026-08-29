import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import type { ChangePasswordSubmit } from "@/views/auth/password-reset/change-password-form/change-password-form-content";
import type { PasswordResetSubmit } from "@/views/auth/password-reset/form/password-reset-form-content";
import type { SignInSubmit } from "@/views/auth/sign-in/form/sign-in-form-content";
import type { SignUpSubmit } from "@/views/auth/sign-up/form/sign-up-form-content";
import type { SSOSelectProvider } from "@/views/auth/sso/buttons/sso-buttons-content";
import type { SSOCallbackResult } from "@/views/auth/sso/callback/sso-callback-result";

import type { SsoCallbackInput } from "./contract";

import { removeAdminSession } from "../admin/state";
import { shouldRefreshSessionAfterSignUp } from "./contract";
import {
  anonymousSession,
  changePasswordFormResult,
  passwordResetFormResult,
  signInFormResult,
  signUpFormResult,
  ssoCallbackResult,
  ssoStartFeedback,
} from "./screens";
import {
  invalidateSession,
  sessionQueryOptions,
  setSessionData,
} from "./session-query";
import { authTransport } from "./transport";

/**
 * The four things a visitor can do to their own session, as VitNode's only
 * auth actions.
 *
 *     component  ->  action  ->  server function  ->  Hono  ->  Set-Cookie
 *                       |
 *                       +->  canonical session cache  ->  route guards
 *
 * Every one of them ends the same way: the cached session is brought back in
 * step with the cookie the browser now holds, *before* anything navigates. That
 * ordering is the whole reason these are hooks and not four inline callbacks -
 * a navigation that runs first arrives at a guard reading the previous
 * visitor's state, which is either a bounce back to the login page or a flash
 * of a page the visitor is no longer entitled to.
 *
 * There is no second auth store. `./session-query` owns the one cache entry
 * every guard and component reads, and these write to exactly that entry.
 *
 * None of this is a security boundary. Hono authorizes every private read from
 * the session cookie, in its own handlers, and keeps doing so whatever this
 * cache says.
 *
 * ## The two things an application has to supply
 *
 * The mutations arrive through `./transport`, because a package may not declare
 * a `createServerFn`. And where a visitor lands afterwards arrives as a
 * `navigate` argument, because that is not this package's decision to make: in
 * `apps/web` a post-login destination may still belong to the Next.js
 * application, so the host passes a navigator that decides between a router
 * navigation and a document load. Once the migration is over, a host will pass
 * `router.navigate` and the seam will read as the plain thing it is.
 */

/**
 * Where to send a visitor once they are signed in, as one call the application
 * owns.
 *
 * Takes an already-validated internal path - `postAuthDestination` in
 * `./redirects` produces one - and resolves when the navigation has been
 * performed, so an action can await it before it reports success.
 */
export type AuthNavigate = (href: string) => Promise<void>;

/**
 * Signing in, in the shape `SignInFormContent` submits.
 *
 * `undefined` on success, which is the shared form's way of saying "the caller
 * is navigating" - and it is, on the line above. On failure the form gets the
 * legacy vocabulary back and renders the alert or the toast itself.
 *
 * The session is invalidated rather than written, because the sign-in reply says
 * only that it worked - the session body comes from the next read, which the
 * destination's guard performs through the one query definition. Doing it before
 * navigating is what makes that read see the new cookie.
 *
 * The guard notices because `ensureAuthState` reads through `fetchQuery`, and an
 * invalidated entry is stale to `isStaleByTime`. It is worth being exact about
 * that rather than trusting "invalidate then read": `ensureQueryData` - the
 * obvious call, and the one this used - returns cached data without consulting
 * the mark at all, so the guard would have decided on the anonymous session and
 * bounced a visitor who had just signed in. See the note on `ensureAuthState`.
 *
 * `navigate` is the caller's, and during the migration that matters: `?returnTo=`
 * names somewhere the visitor was heading, and most of VitNode has not moved
 * yet. `apps/web` passes `useMigrationNavigate`, which asks the route tree
 * whether this application serves the destination - `/discover` is a client-side
 * navigation, `/settings/security?tab=devices` is a full-document load into the
 * Next.js app that still serves it - so there is no list of migrated auth
 * destinations here or anywhere else.
 */
export const useSignInAction = ({
  destination,
  navigate,
}: {
  destination: () => string;
  navigate: AuthNavigate;
}): SignInSubmit => {
  const queryClient = useQueryClient();

  return async values => {
    const result = await authTransport().signIn(values);

    if (!result.ok) return signInFormResult(result);

    // Somebody has just identified themselves, and it may not be whoever this
    // browser held an admin answer for. Dropping the entry costs nothing when
    // there is none - which is the usual case on the public login page - and
    // forces the answer to be re-derived from the cookie when there is. See the
    // long note on `useSignOutAction`.
    removeAdminSession(queryClient);

    await invalidateSession(queryClient);
    await navigate(destination());

    return undefined;
  };
};

/**
 * Starting an SSO sign-in.
 *
 * A plain function rather than a hook: it reads no cached state and moves no
 * router, because success leaves this application entirely.
 *
 * The provider is another origin, so leaving is a full-document navigation
 * rather than a router one - and it has to be, because the round trip comes back
 * to a URL the provider was told about, not to a client-side route.
 *
 * The reply to this call carries the API's short-lived `--state-sso` cookie,
 * which `saveApiCookies` writes onto the browser before this returns. Navigating
 * away any earlier would lose it and the callback would fail its state check.
 */
export const startSsoAction: SSOSelectProvider = async providerId => {
  const result = await authTransport().startSso({ providerId });

  if (!result.ok) return ssoStartFeedback(result);

  globalThis.location.assign(result.url);

  return undefined;
};

/**
 * Finishing an SSO sign-in - the exchange half of `useSSOCallback`.
 *
 * Takes the parameters `parseSsoCallback` validated, or `null` when the callback
 * URL never carried a usable set. `null` answers `unknown` without calling the
 * API at all: a callback with no `code` has nothing to exchange, and sending it
 * anyway would be a request whose only possible outcome is an error.
 */
export const useCompleteSsoAction = (params: null | SsoCallbackInput) => {
  const queryClient = useQueryClient();

  return async (): Promise<SSOCallbackResult> => {
    if (!params) return { failure: "unknown" };

    const result = await authTransport().completeSso(params);

    if (result.ok) await invalidateSession(queryClient);

    return ssoCallbackResult(result);
  };
};

/**
 * Signing out.
 *
 * Two writes, in this order, and both are needed:
 *
 * 1. **Write the anonymous session.** The reply carries the cookie deletion but
 *    not a session body, so without this the cache still holds the previous
 *    visitor until a refetch returns - and every guard and component reading it
 *    in between believes them still signed in.
 * 2. **Invalidate.** The written value is this layer's inference, not the server's
 *    answer; marking it stale means the next reader confirms it.
 *
 * `router.invalidate()` then re-runs the matched routes' `beforeLoad`, so a
 * visitor sitting on a page behind `_authenticated` is redirected out of it by
 * the guard that owns that rule, rather than by anything here.
 *
 * The header's user menu is what calls it, and it is the only sign-out control
 * VitNode renders.
 *
 * The failure is *reported* rather than thrown, and the caller decides: the
 * header raises the internal-error toast and stays signed in, which is honest -
 * a session that could not be ended is still a session.
 *
 * ## The admin session is dropped either way
 *
 * `isAdmin` picks which cookie the API deletes, but the *cache* is cleared for
 * both, and `removeQueries` rather than an invalidation. Two reasons, and the
 * second is the one that is easy to miss:
 *
 * - **`isAdmin: true`** is the AdminCP's own sign-out. Marking the entry stale
 *   would leave this administrator's permission set in the browser, rendered by
 *   anything still mounted, until a refetch returned. Since the next person at
 *   this browser may be a different administrator signing in, "until a refetch"
 *   is a window where one admin sees another's sidebar.
 * - **`isAdmin: false`** does not touch the admin cookie at all - but it does
 *   mean the person in front of the browser has stated they are leaving. The
 *   right response to "who is this?" becoming uncertain is to re-derive the
 *   answer from the cookie rather than to reuse the last one, and the admin
 *   query costs one request to do that.
 *
 * Neither is a security property: the admin cookie is what authorizes an admin
 * API call, and Hono re-reads it every time. This is about what the *browser*
 * renders between a sign-out and the next read.
 */
export const useSignOutAction = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return async ({ isAdmin = false }: { isAdmin?: boolean } = {}) => {
    const result = await authTransport().signOut({ isAdmin });

    if (!result.ok) return result;

    const current = queryClient.getQueryData(sessionQueryOptions().queryKey);
    if (current) setSessionData(queryClient, anonymousSession(current));

    removeAdminSession(queryClient);

    await invalidateSession(queryClient);
    await router.invalidate();

    return result;
  };
};

/**
 * Registering, in the shape `SignUpFormContent` submits.
 *
 * The one action here with two success paths, and the ordering in the verified
 * one is the whole reason it is a hook:
 *
 *     signUp()                    the API mints the session, saveApiCookies puts
 *                                 the cookie on this response
 *     invalidateSession()         the canonical entry every guard reads is marked
 *                                 stale, and every component observing it
 *                                 refetches before this resolves
 *     navigate(destination())     and arrives as the new visitor
 *
 * Navigating first would arrive at a guard still holding the anonymous session
 * and bounce a freshly-registered visitor to the login page. The guard sees the
 * mark because `ensureAuthState` reads through `fetchQuery` rather than
 * `ensureQueryData`, which would have ignored it - see the note there.
 *
 * `shouldRefreshSessionAfterSignUp` decides which path this is, rather than an
 * inline `result.emailVerified`: an unverified account is *not* a session, so the
 * cache must not be touched and the form must not be told to stand down. It gets
 * `{ emailConfirmation }` instead and swaps itself for the "check your email"
 * screen.
 *
 * There is no second auth store. This writes to the one entry `./session-query`
 * owns, exactly as the sign-in action does.
 *
 * `destination` is a thunk for the same reason as on the login page: where to
 * land can depend on a search parameter that changes under the form, and reading
 * it at submit time rather than at mount time is what keeps the two in step.
 * `navigate` is the caller's, so a destination the application does not own yet
 * can become a document load rather than a client navigation to a route that
 * cannot render.
 */
export const useSignUpAction = ({
  destination,
  navigate,
}: {
  destination: () => string;
  navigate: AuthNavigate;
}): SignUpSubmit => {
  const queryClient = useQueryClient();

  return async values => {
    const result = await authTransport().signUp(values);

    if (shouldRefreshSessionAfterSignUp(result)) {
      await invalidateSession(queryClient);
      await navigate(destination());
    }

    return signUpFormResult(result);
  };
};

/**
 * Asking for a password-reset link, in the shape `PasswordResetFormContent`
 * submits.
 *
 * A plain function rather than a hook: nothing about it touches the session, the
 * router or any cached state. It cannot - the API mints no session here, and the
 * visitor stays exactly where they are while the form swaps itself for the
 * confirmation screen.
 *
 * The result says only whether the request was accepted. An address with an
 * account and one without produce the identical `{ ok: true }`, because the API
 * answers the identical `201`, and nothing in this path may add a distinction it
 * withholds.
 */
export const requestPasswordResetAction: PasswordResetSubmit = async values =>
  passwordResetFormResult(await authTransport().requestPasswordReset(values));

/**
 * Setting a new password from a recovery link, in the shape
 * `ChangePasswordFormContent` submits.
 *
 * Also a plain function, and deliberately so: the API changes the password and
 * deletes the recovery row without minting a session, so there is nothing to
 * refresh and nobody to sign in. Inventing either here would be this app
 * asserting an authentication the server never performed.
 *
 * The link travels as an already-parsed `RecoveryLink` - the route reads it
 * out of the URL through `parseRecoveryLink` - so `userId` is a number by the time
 * it reaches here, and the server function validates it again on arrival because
 * its input is whatever a caller posts.
 *
 * Where the visitor goes afterwards is `onChanged` on the shared form, not this:
 * the destination is the login page, and moving the router belongs to the route
 * that has one.
 */
export const changePasswordFromResetAction: ChangePasswordSubmit =
  async values =>
    changePasswordFormResult(
      await authTransport().changePasswordFromReset(values),
    );
