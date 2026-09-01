import type { Context } from "hono";
import type { CookieOptions } from "hono/utils/cookie";

import { deleteCookie, setCookie } from "hono/cookie";

/**
 * The attributes every VitNode auth cookie is written with - and the ones a
 * deletion has to repeat.
 *
 * A browser identifies a cookie by name, domain *and* path, so a `Set-Cookie`
 * that removes one has to name the same three. Reading both sides from here is
 * what stops them drifting: a sign-out sending no `Domain` against a cookie
 * created with one deletes nothing at all, and says nothing while it happens.
 *
 * `domain` is absent unless an install explicitly asks for one. Left off, the
 * cookie is *host-only* - bound to exactly the host that sent it - which is the
 * right default for how VitNode deploys: the web app serves `/api/*` on its own
 * origin, so there is no second host to share the cookie with. It is also the
 * only default that works everywhere, because the host is not knowable ahead of
 * time. A preview deployment's hostname is generated per branch, and a `Domain`
 * naming anything the response did not come from - `localhost`, the production
 * domain - is one the browser rejects outright, taking sign-in with it.
 *
 * Set `authorization.cookieDomain` to share a session across subdomains; see
 * `VitNodeApiConfig`.
 */
const authCookieOptions = (c: Context): CookieOptions => {
  const { cookieDomain, cookieSecure } = c.get("core").authorization;

  return {
    // `undefined` emits no `Domain` attribute at all, which is the host-only
    // default described above - not a domain of `"undefined"`.
    domain: cookieDomain,
    httpOnly: true,
    path: "/",
    // Stated rather than left to the browser. Chrome and Firefox default an
    // omitted `SameSite` to `Lax`, but that is a default and not a rule: Safari
    // and older engines have their own, and a cookie whose cross-site behaviour
    // depends on which browser is reading it is one nobody can reason about.
    // `Lax` and not `Strict` because the SSO round trip lands here as a
    // top-level cross-site GET - `Strict` would drop the state cookie on the way
    // back from the provider and break every social sign-in.
    sameSite: "Lax",
    secure: cookieSecure,
  };
};

/**
 * Writes one of VitNode's auth cookies - the session, the admin session, the
 * device id, the SSO state. `expires` is the only per-cookie attribute; the
 * rest are shared so that {@link deleteAuthCookie} can mirror them.
 *
 * Omit `expires` for a session cookie the browser should drop when it closes.
 */
export const setAuthCookie = (
  c: Context,
  name: string,
  value: string,
  { expires }: { expires?: Date } = {},
): void => {
  setCookie(c, name, value, { ...authCookieOptions(c), expires });
};

/**
 * Removes one of VitNode's auth cookies, with the attributes it was created
 * with.
 *
 * Always use this rather than `deleteCookie` directly: a deletion whose `Domain`
 * or `Path` does not match the cookie's leaves it in the browser, and the
 * response looks identical either way.
 */
export const deleteAuthCookie = (c: Context, name: string): void => {
  deleteCookie(c, name, authCookieOptions(c));
};
