/**
 * The cookie that remembers which language a visitor chose.
 *
 * Named like the rest of VitNode's cookies (`vitnode_auth`, `vitnode_device`)
 * so an install can find them all at once.
 *
 * It is deliberately *not* how a public page picks its language - that comes
 * from the URL, always. This is what `/admin` and anything else outside the
 * localized URL space reads, and what a language switch writes so the next
 * visit to one of those pages starts in the right language.
 */
export const LOCALE_COOKIE_NAME = "vitnode_locale";

/** A year. The choice is a preference, not a session, and it never expires. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export interface LocaleCookieOptions {
  maxAge?: number;
  name?: string;
  /**
   * Adds `Secure`. Leave it off over plain HTTP - a `Secure` cookie set on
   * `http://localhost` is dropped by the browser without a word, and the
   * language switch then silently forgets itself on every reload.
   */
  secure?: boolean;
}

/**
 * Reads the locale cookie out of a `Cookie` header or `document.cookie`.
 *
 * Both are the same format - `a=1; b=2` - which is why this takes a string
 * rather than a request: the server hands it a header, the browser hands it
 * `document.cookie`, and neither needs to know about the other.
 *
 * Splits on the *first* `=` only: a value may legitimately contain more.
 */
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

/**
 * The `Set-Cookie` value for a chosen locale.
 *
 * `Path=/` because the choice applies to the whole site, `SameSite=Lax` because
 * it must survive somebody following a link in from elsewhere - the case where
 * getting the language right matters most - while still not riding along on
 * cross-site form posts. No `HttpOnly`: the browser sets this one too, when the
 * switcher runs client-side, and a cookie only one half can write is a cookie
 * the two halves disagree about.
 */
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
