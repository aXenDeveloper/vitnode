export const DOCUMENT_CACHE_CONTROL = "private, no-store";

export type DocumentSecurityHeaders = Record<string, false | string>;

export const DOCUMENT_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "content-security-policy": "frame-ancestors 'self'",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "SAMEORIGIN",
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
