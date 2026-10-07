export const DOCUMENT_CACHE_CONTROL = "private, no-store";

/**
 * Header name -> value, or `false` to drop one of the defaults.
 */
export type DocumentSecurityHeaders = Record<string, false | string>;

/**
 * Sent with every rendered HTML page. Deliberately conservative:
 *
 * - `frame-ancestors 'self'` and its legacy twin `X-Frame-Options` stop another
 *   site from framing the AdminCP and clickjacking a signed-in admin;
 * - `nosniff` keeps the browser from reinterpreting a response's type;
 * - `strict-origin-when-cross-origin` keeps paths and query strings out of the
 *   `Referer` sent to other sites.
 *
 * No script policy - one strict enough to matter would break plugins and
 * inline bootstrapping - and no HSTS, which only belongs on an origin that is
 * HTTPS for good. Both can be added through `securityHeaders`.
 */
export const DOCUMENT_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "content-security-policy": "frame-ancestors 'self'",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "SAMEORIGIN",
};

/** The defaults with an install's own `securityHeaders` laid over them. */
export const resolveDocumentSecurityHeaders = (
  overrides: DocumentSecurityHeaders = {},
): Record<string, string> => {
  const merged: DocumentSecurityHeaders = { ...DOCUMENT_SECURITY_HEADERS };
  for (const [name, value] of Object.entries(overrides)) {
    merged[name.toLowerCase()] = value;
  }

  return Object.fromEntries(
    Object.entries(merged).filter(
      (entry): entry is [string, string] => entry[1] !== false,
    ),
  );
};

const isRenderedDocument = (headers: Headers): boolean =>
  (headers.get("content-type") ?? "").toLowerCase().startsWith("text/html");

export const applyDocumentCacheControl = (response: Response): void => {
  if (!isRenderedDocument(response.headers)) return;

  response.headers.set("cache-control", DOCUMENT_CACHE_CONTROL);
};

/**
 * Adds the security headers to a rendered HTML page. A header the response
 * already carries - one a route set for itself - is left as it is.
 */
export const applyDocumentSecurityHeaders = (
  response: Response,
  headers: Record<string, string> = DOCUMENT_SECURITY_HEADERS,
): void => {
  if (!isRenderedDocument(response.headers)) return;

  for (const [name, value] of Object.entries(headers)) {
    if (!response.headers.has(name)) response.headers.set(name, value);
  }
};

export const applyRedirectCacheControl = (response: Response): void => {
  if (!response.headers.has("set-cookie")) return;

  response.headers.set("cache-control", DOCUMENT_CACHE_CONTROL);
};
