import type { Context } from "hono";
import type { CookieOptions } from "hono/utils/cookie";

import { deleteCookie, setCookie } from "hono/cookie";

/** The public session cookie, unless `authorization.cookieName` renames it. */
export const DEFAULT_SESSION_COOKIE_NAME = "vitnode_auth";

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

export const setAuthCookie = (
  c: Context,
  name: string,
  value: string,
  { expires }: { expires?: Date } = {},
): void => {
  setCookie(c, name, value, { ...authCookieOptions(c), expires });
};

export const deleteAuthCookie = (c: Context, name: string): void => {
  deleteCookie(c, name, authCookieOptions(c));
};
