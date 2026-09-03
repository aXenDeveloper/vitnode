export const LOCALE_COOKIE_NAME = "vitnode_locale";

/** A year. The choice is a preference, not a session, and it never expires. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export interface LocaleCookieOptions {
  maxAge?: number;
  name?: string;

  secure?: boolean;
}

export const readLocaleCookie = (
  header: null | string | undefined,
  name: string = LOCALE_COOKIE_NAME,
): string | undefined => {
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const entry = part.trim();
    const separator = entry.indexOf("=");
    if (separator === -1) continue;
    if (entry.slice(0, separator) !== name) continue;

    try {
      return decodeURIComponent(entry.slice(separator + 1)) || undefined;
    } catch {
      // A malformed percent-escape is not a locale. Fall through so the caller
      // treats it as "no preference" rather than throwing mid-request.
      return undefined;
    }
  }

  return undefined;
};

export const serializeLocaleCookie = (
  locale: string,
  {
    maxAge = LOCALE_COOKIE_MAX_AGE,
    name = LOCALE_COOKIE_NAME,
    secure = false,
  }: LocaleCookieOptions = {},
): string =>
  [
    `${name}=${encodeURIComponent(locale)}`,
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
