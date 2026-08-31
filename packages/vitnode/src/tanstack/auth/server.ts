import "@tanstack/react-start/server-only";

import type { usersModule } from "@/api/modules/users/users.module";

import { clientModule } from "@/lib/fetcher-client";
import { CAPTCHA_TOKEN_HEADER } from "@/lib/fetcher/request-context";
import { fetcherServer, saveApiCookies } from "@/tanstack/fetcher/server";

import type {
  ChangePasswordInput,
  ChangePasswordResult,
  CompleteSsoResult,
  PasswordResetRequestInput,
  PasswordResetRequestResult,
  SignInInput,
  SignInResult,
  SignOutInput,
  SignOutResult,
  SignUpInput,
  SignUpResult,
  SsoCallbackInput,
  SsoStartInput,
  SsoStartResult,
} from "./contract";

import {
  changePasswordResultFromStatus,
  completeSsoResultFromStatus,
  isUsableSessionStatus,
  passwordResetRequestResultFromStatus,
  SESSION_UNAVAILABLE,
  shouldSaveApiCookies,
  signInResultFromStatus,
  signOutResultFromStatus,
  signUpResultFromStatus,
  ssoStartResultFromStatus,
} from "./contract";

/**
 * The session read and the seven auth mutations against the Hono users API - the
 * half that can only run on a server.
 *
 *     createServerFn -> here -> fetcherServer -> Hono users API
 *                                                     |
 *                  browser <- saveApiCookies <- Set-Cookie
 *
 * `@vitnode/core/tanstack/auth/server`, and the only subpath of this feature
 * that is allowed to be one: it imports the request scope
 * (`getRequestHeaders`, `setCookie`) and the `server-only` marker above, and the
 * barrel beside it is imported by browser bundles. Reached only from inside a
 * host's `createServerFn` handler, which is what keeps it - and the marker - out
 * of the client build: the Start compiler removes a handler body, and the
 * imports left unused with it, from the client compile.
 *
 * The `createServerFn` itself stays in the host, and this module is the reason
 * that costs nothing. A server function declared *here* would answer the browser
 * correctly over `/_serverFn/*` and silently resolve to `undefined` during SSR,
 * because the host externalises this package from Vite's SSR pass and nothing in
 * that path runs the Start compiler. So the host declares eight one-line
 * wrappers, registers them through `./transport`, and every decision below is
 * made once, here.
 *
 * The API is unchanged and unrelaxed: it still hashes the password, mints the
 * session, verifies the OAuth `state` against its own cookie and decides every
 * status. Everything here is transport - forward the request state, copy the
 * cookies back, and turn a status into one of the finite results in
 * `./contract`.
 */

/**
 * The users module by type only, so nothing the API needs at runtime - Hono,
 * Drizzle, the plugin tree - is pulled in by a value import. `clientModule`
 * keeps the route paths, methods and response schemas fully typed while
 * carrying just the `pluginId` the fetcher reads.
 */
const users = clientModule<typeof usersModule>("@vitnode/core");

/**
 * The signed-in visitor, or `{ user: null }` - the TanStack Start counterpart of
 * `@vitnode/core`'s `getSessionApi()`, and the shape {@link SessionApi} is read
 * off.
 *
 * ## It rejects rather than inventing a guest
 *
 * `{ user: null }` means one thing only: the API answered, and nobody is signed
 * in. A read that could not be *evaluated* - a 429 from the rate limiter, a 500,
 * an API that is not listening - is an error, not an anonymous visitor.
 *
 * This used to return `{ ai: { models: [] }, user: null }` for every non-200,
 * which signed people out during an outage: the guard on a protected route read
 * the fabricated `user: null`, believed it, and redirected a signed-in visitor
 * to the login page. Rejecting instead leaves the query in an error state, which
 * is what TanStack Query is for, and the route's normal error path handles it.
 *
 * `rawApiFetch` already throws on a 500, so that case arrives here as an
 * exception and is handled identically - one failure mode, not two.
 *
 * Wrapped by the host in a `createServerFn` rather than called from a route
 * `loader`, because a loader also runs in the browser on client-side navigation
 * and there is no request to read there. As a server function it runs on the
 * server both times: directly during SSR, and over same-origin RPC afterwards -
 * which carries the visitor's cookies to this server, where `fetcherServer`
 * forwards them on.
 *
 * Deliberately not cached, for the same reason `getSessionApi()` is not: the
 * response is per-visitor and changes the moment they sign in or edit their
 * profile, so there is no shared entry to hand out. The database work behind it
 * is cached in Redis by the API instead. One call per navigation as long as
 * callers read it through `sessionQueryOptions`, which is the point of there
 * being one cache entry.
 */
export const readSessionOnApi = async () => {
  try {
    const response = await fetcherServer(users, {
      method: "get",
      module: "users",
      path: "/session",
    });

    if (isUsableSessionStatus(response.status)) return await response.json();

    // Caught immediately below. Thrown rather than returned so there is one
    // failure path and one log line, and so the status reaches the log.
    throw new Error(`the session route answered ${response.status}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[auth] ${SESSION_UNAVAILABLE}`, error);

    // No `cause`: this error is serialized back to the browser, and the one it
    // would carry is `rawApiFetch`'s - the failing API URL and the server's own
    // error text. It has just been written to the server log, which is where it
    // belongs; attaching it here would publish it. This is the whole reason the
    // message is a fixed sentence.
    // eslint-disable-next-line preserve-caught-error
    throw new Error(SESSION_UNAVAILABLE);
  }
};

/**
 * The API's reply, or `null` when the call never produced one.
 *
 * `rawApiFetch` *throws* on a 500 rather than returning it, with the failing URL
 * and the server's error text in the message, and a fetch to a server that is
 * not listening throws too. Both have to be caught: an error escaping a server
 * function is serialized back to the browser, which would put exactly that text
 * in front of a visitor. It is logged where a server log is the right place for
 * it, and `null` becomes the same `server_error` any other unexpected status
 * maps to.
 */
const callUsersApi = async (
  call: () => Promise<Response>,
): Promise<null | Response> => {
  try {
    return await call();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[auth] users API call failed", error);

    return null;
  }
};

/**
 * A reply's body, as JSON, or `undefined`.
 *
 * A body that is not JSON - an HTML error page from something in front of the
 * API, an empty response - makes `json()` throw, and an exception escaping a
 * server function is serialized back to the browser. `undefined` fails the
 * `201` schema instead, which the caller already reads as a `server_error`.
 */
const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

/**
 * A reply's body as text, or `""`.
 *
 * Only ever handed to core's `signUpConflictReason`, which classifies it and
 * throws it away; `""` classifies as `"unknown"`, which is the right answer for a
 * conflict nobody could read.
 */
const readText = async (response: Response): Promise<string> => {
  try {
    return await response.text();
  } catch {
    return "";
  }
};

/**
 * Copies the session, device and SSO-state cookies the API just minted onto this
 * app's response.
 *
 * 2xx only - see `shouldSaveApiCookies`, which is the rule Next's
 * `allowSaveCookies` applies and therefore the one the legacy flow was built on.
 * Guarded rather than unconditional because `saveApiCookies` writes every cookie
 * a response carries, so it is only ever handed a reply this layer decided to
 * trust.
 */
const saveCookiesFrom = (response: Response): void => {
  if (shouldSaveApiCookies(response.status)) saveApiCookies(response);
};

/**
 * Signs a visitor in with an email and a password.
 *
 * `201` with the session cookie attached, `403` for an unknown address or a
 * wrong password. The cookie is the entire point of the round trip, so it is
 * copied before anything looks at the status.
 */
export const signInOnApi = async (data: SignInInput): Promise<SignInResult> => {
  const response = await callUsersApi(async () =>
    fetcherServer(users, {
      args: { body: data },
      method: "post",
      module: "users",
      path: "/sign_in",
    }),
  );

  if (!response) return { ok: false, reason: "server_error" };

  saveCookiesFrom(response);

  return signInResultFromStatus(response.status);
};

/**
 * Ends the current session.
 *
 * The request has to carry the visitor's cookies - that is how the API knows
 * which session row to delete - and the reply's `Set-Cookie` has to come back,
 * because that *is* the deletion. Hono spells it `name=; Max-Age=0`, which
 * `parseSetCookies` preserves as `maxAge: 0`; dropping it would leave an empty
 * cookie in the browser until it closed.
 */
export const signOutOnApi = async (
  data: SignOutInput,
): Promise<SignOutResult> => {
  const response = await callUsersApi(async () =>
    fetcherServer(users, {
      args: { body: { isAdmin: data.isAdmin ?? false } },
      method: "delete",
      module: "users",
      path: "/sign_out",
    }),
  );

  if (!response) return { ok: false, reason: "server_error" };

  saveCookiesFrom(response);

  return signOutResultFromStatus(response.status);
};

/**
 * Starts an SSO sign-in: asks the API for the provider's authorization URL.
 *
 * The reply carries a cookie as well as a URL - the API mints the OAuth `state`
 * and stores its hash in a short-lived `--state-sso` cookie - so this is a
 * mutation with a `Set-Cookie` like the others, and losing that cookie means the
 * callback fails its state check. Which is the whole reason it goes through a
 * server function rather than a browser fetch.
 */
export const startSsoOnApi = async (
  data: SsoStartInput,
): Promise<SsoStartResult> => {
  const response = await callUsersApi(async () =>
    fetcherServer(users, {
      args: { params: { providerId: data.providerId } },
      method: "post",
      module: "users/sso",
      path: "/{providerId}",
    }),
  );

  if (!response) return { ok: false, reason: "server_error" };

  saveCookiesFrom(response);

  if (response.status !== 200) {
    return ssoStartResultFromStatus(response.status, undefined);
  }

  const { url } = await response.json();

  return ssoStartResultFromStatus(response.status, url);
};

/**
 * Completes an SSO sign-in with what the provider sent the visitor back with.
 *
 * The API does all of the security-relevant work and keeps doing it: it verifies
 * `state` against the `--state-sso` cookie this request forwards, deletes that
 * cookie, exchanges the `code` with the provider and mints the session. This
 * layer validates the shape of the three values, forwards them, and copies the
 * session cookie back.
 */
export const completeSsoOnApi = async (
  data: SsoCallbackInput,
): Promise<CompleteSsoResult> => {
  const response = await callUsersApi(async () =>
    fetcherServer(users, {
      args: {
        params: { providerId: data.providerId },
        query: { code: data.code, state: data.state },
      },
      method: "get",
      module: "users/sso",
      path: "/{providerId}/callback",
    }),
  );

  if (!response) return { ok: false, reason: "server_error" };

  saveCookiesFrom(response);

  return completeSsoResultFromStatus(response.status);
};

/**
 * The captcha header, or nothing at all.
 *
 * `useCaptcha` reports itself ready with an empty token when this deployment has
 * no captcha configured, and the API's `captchaMiddleware` short-circuits in
 * exactly that case - but only if the header is *absent*. An empty
 * `x-vitnode-captcha-token` is a present header with no token, which a configured
 * deployment would reject as `400 "Captcha token is required"`. So the absence is
 * the meaningful part, which is why this is a spread and not a value.
 *
 * The header name comes from `@vitnode/core`, where the middleware reads it, so
 * an application never spells it out.
 */
const captchaHeaders = (captchaToken: string): Record<string, string> =>
  captchaToken ? { [CAPTCHA_TOKEN_HEADER]: captchaToken } : {};

/**
 * Registers a new account.
 *
 * The one mutation here whose success may or may not be a session, and the reason
 * the cookies are copied before the status is looked at. On a deployment with no
 * email adapter the API marks the account verified and calls
 * `createSessionByUserId` on the same request, so the `201` carries a
 * `Set-Cookie` this server has to forward - lose it and the visitor is registered
 * and immediately anonymous. On a deployment *with* one, the same `201` carries
 * no session and `emailVerified: false` says so.
 *
 * The two bodies that are read are read for different reasons: the `201` because
 * the caller needs the address and the flag, and the `409` because the API puts
 * the conflicting field's name in its text. Neither string is forwarded - the
 * `409` is classified by core's own `signUpConflictReason` and the `201` is parsed
 * by a schema.
 */
export const signUpOnApi = async ({
  captchaToken,
  ...body
}: SignUpInput): Promise<SignUpResult> => {
  const response = await callUsersApi(async () =>
    fetcherServer(users, {
      additionalHeaders: captchaHeaders(captchaToken),
      args: { body },
      method: "post",
      module: "users",
      path: "/sign_up",
    }),
  );

  if (!response) return { ok: false, reason: "server_error" };

  saveCookiesFrom(response);

  if (response.status === 201) {
    return signUpResultFromStatus(201, { body: await readJson(response) });
  }

  if (response.status === 409) {
    return signUpResultFromStatus(409, { conflict: await readText(response) });
  }

  return signUpResultFromStatus(response.status);
};

/**
 * Asks the API to email a password-reset link.
 *
 * No cookies to copy: this route mints nothing, and `saveApiCookies` writes every
 * cookie a response carries, so it is not called for a response that has no
 * business setting one.
 *
 * Nothing is read off the reply either, and nothing could be: the API answers
 * `201` whether or not the address belongs to an account. Preserving that
 * silence is the point - see `passwordResetRequestResultFromStatus`.
 */
export const requestPasswordResetOnApi = async ({
  captchaToken,
  email,
}: PasswordResetRequestInput): Promise<PasswordResetRequestResult> => {
  const response = await callUsersApi(async () =>
    fetcherServer(users, {
      additionalHeaders: captchaHeaders(captchaToken),
      args: { body: { email } },
      method: "post",
      module: "users",
      path: "/reset-password",
    }),
  );

  if (!response) return { ok: false, reason: "server_error" };

  return passwordResetRequestResultFromStatus(response.status);
};

/**
 * Sets a new password from a recovery link.
 *
 * The API does all of the security-relevant work and keeps doing it: it looks the
 * recovery row up by `userId` *and* `token` *and* an unexpired `expiresAt`,
 * rejects the request when any of the three does not match, hashes the new
 * password and deletes the row. This layer validates the shape of the three
 * values and maps the status.
 *
 * **No session is minted and none is copied.** The route answers `201` with no
 * `Set-Cookie`, so a visitor who has just changed their password is still signed
 * out - which is why this is the one mutation here that does not go anywhere near
 * `saveCookiesFrom`, and why a caller must not refresh a session around it.
 */
export const changePasswordFromResetOnApi = async (
  data: ChangePasswordInput,
): Promise<ChangePasswordResult> => {
  const response = await callUsersApi(async () =>
    fetcherServer(users, {
      args: { body: data },
      method: "post",
      module: "users",
      path: "/change-password",
    }),
  );

  if (!response) return { ok: false, reason: "server_error" };

  return changePasswordResultFromStatus(response.status);
};
