import { cookieFromStringToObject } from "./cookie-from-string-to-object";

/**
 * A `Set-Cookie` header from the API, split into the shape every cookie store
 * takes: a name, a value, and the attributes.
 *
 * Framework-free on purpose. The API mints the session and device cookies, so
 * whichever frontend made the call has to copy them onto its own response -
 * Next through `cookies().set()`, TanStack Start through `setCookie()`. Parsing
 * them twice is how the two drift apart.
 */
export interface ParsedSetCookie {
  name: string;
  options: {
    domain?: string;
    expires?: Date;
    httpOnly?: boolean;
    path?: string;
    sameSite?: "lax" | "none" | "strict";
    secure?: boolean;
  };
  value: string;
}

const parseSameSite = (
  value: unknown,
): ParsedSetCookie["options"]["sameSite"] => {
  if (typeof value !== "string") return undefined;

  const normalized = value.toLowerCase();

  return normalized === "lax" ||
    normalized === "none" ||
    normalized === "strict"
    ? normalized
    : undefined;
};

/**
 * An `Expires` the browser would honour, or nothing. A cookie sent without one
 * is a session cookie, and passing an `Invalid Date` on to a cookie store
 * serializes to a value browsers throw away - so the two cases are the same
 * outcome reached by accident. This makes it the same outcome on purpose.
 */
const parseExpires = (value: unknown): Date | undefined => {
  if (typeof value !== "string") return undefined;

  const expires = new Date(value);

  return Number.isNaN(expires.getTime()) ? undefined : expires;
};

const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

/**
 * A flag is present only when the attribute was there at all. Typed `unknown`
 * because `cookieFromStringToObject` declares these as `boolean` while the key
 * is simply missing when the attribute is absent.
 */
const asFlag = (value: unknown): boolean => value === true;

/**
 * Every cookie in a response's `Set-Cookie` headers, ready to be written to a
 * cookie store. Pass `response.headers.getSetCookie()`.
 */
export const parseSetCookies = (
  setCookieHeaders: string[],
): ParsedSetCookie[] =>
  cookieFromStringToObject(setCookieHeaders).flatMap(cookie => {
    // The name/value pair is the first entry; the rest are attributes.
    const [name] = Object.keys(cookie);
    const value = name === undefined ? undefined : cookie[name];

    if (typeof name !== "string" || typeof value !== "string") return [];

    return [
      {
        name,
        options: {
          domain: asString(cookie.Domain),
          expires: parseExpires(cookie.Expires),
          httpOnly: asFlag(cookie.HttpOnly),
          path: asString(cookie.Path),
          sameSite: parseSameSite(cookie.SameSite),
          secure: asFlag(cookie.Secure),
        },
        value,
      },
    ];
  });
