export const DOCUMENT_CACHE_CONTROL = "private, no-store";

export type DocumentSecurityHeaders = Record<string, false | string>;

export const DOCUMENT_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "content-security-policy": "frame-ancestors 'self'",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "SAMEORIGIN",
};

/**
 * Pages that must never render inside a frame, even one on this site: a
 * consent screen a framing page could trick a member into clicking through.
 * Internal paths, without a locale prefix.
 */
export const FRAME_DENIED_PATHS: readonly string[] = ["/oauth/authorize"];

export const isFrameDeniedPath = (pathname: string): boolean => {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  return FRAME_DENIED_PATHS.includes(path);
};

const FRAME_ANCESTORS_NONE = "frame-ancestors 'none'";

/**
 * `headers` with framing forbidden outright: `x-frame-options: DENY`, and the
 * content security policy's `frame-ancestors` replaced with `'none'` - the
 * rest of an app's own policy is kept.
 */
export const withFramingDenied = (
  headers: Record<string, string>,
): Record<string, string> => {
  const directives = (headers["content-security-policy"] ?? "")
    .split(";")
    .map(directive => directive.trim())
    .filter(
      directive =>
        directive !== "" && !/^frame-ancestors(\s|$)/i.test(directive),
    );

  return {
    ...headers,
    "content-security-policy": [...directives, FRAME_ANCESTORS_NONE].join("; "),
    "x-frame-options": "DENY",
  };
};

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
