import type { Context } from "hono";
import type { CookieOptions } from "hono/utils/cookie";

import { deleteCookie, setCookie } from "hono/cookie";

const authCookieOptions = (c: Context): CookieOptions => {
  const { cookieDomain, cookieSecure } = c.get("core").authorization;

  return {
    // `undefined` emits no `Domain` attribute at all, which is the host-only
    // default described above - not a domain of `"undefined"`.
    domain: cookieDomain,
    httpOnly: true,
    path: "/",
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
