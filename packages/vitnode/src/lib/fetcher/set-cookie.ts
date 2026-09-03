import { cookieFromStringToObject } from "./cookie-from-string-to-object";

export const shouldSaveApiCookies = (status: number): boolean =>
  status >= 200 && status < 300;

export interface ParsedSetCookie {
  name: string;
  options: {
    domain?: string;
    expires?: Date;
    httpOnly?: boolean;
    /**
     * Lifetime in seconds. `0` is a value, not an absence: it is how the API
     * deletes a cookie, so nothing downstream may treat it as falsy.
     */
    maxAge?: number;
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

const parseExpires = (value: unknown): Date | undefined => {
  if (typeof value !== "string") return undefined;

  const expires = new Date(value);

  return Number.isNaN(expires.getTime()) ? undefined : expires;
};

const parseMaxAge = (value: unknown): number | undefined => {
  if (typeof value !== "string" || !/^-?\d+$/.test(value)) return undefined;

  return Number(value);
};

const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

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
          // Both are forwarded when the API sends both; browsers already give
          // `Max-Age` precedence, so narrowing it here would only lose fidelity.
          maxAge: parseMaxAge(cookie["Max-Age"]),
          path: asString(cookie.Path),
          sameSite: parseSameSite(cookie.SameSite),
          secure: asFlag(cookie.Secure),
        },
        value,
      },
    ];
  });
