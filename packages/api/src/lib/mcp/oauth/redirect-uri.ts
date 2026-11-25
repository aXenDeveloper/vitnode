import type { ResolvedMcpConfig } from "../config";

const MAX_REDIRECT_URI_LENGTH = 2000;

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"]);

// Schemes that run code or read local data in the browser, never a callback.
const FORBIDDEN_SCHEMES = new Set([
  "about:",
  "blob:",
  "data:",
  "file:",
  "filesystem:",
  "javascript:",
  "vbscript:",
  "ws:",
  "wss:",
]);

const parse = (value: string): null | URL => {
  if (
    value.length === 0 ||
    value.length > MAX_REDIRECT_URI_LENGTH ||
    // No fragment (RFC 6749 §3.1.2), not even an empty one, and no wildcard.
    value.includes("#") ||
    value.includes("*") ||
    // Whitespace and control characters never belong in a callback, and
    // `URL` would silently strip some of them.
    /[\s\p{Cc}]/u.test(value)
  ) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    if (FORBIDDEN_SCHEMES.has(url.protocol)) return null;

    return url;
  } catch {
    return null;
  }
};

const isLoopback = (url: URL): boolean =>
  url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);

/**
 * Whether a client may register `value` as a redirect URI: listed verbatim in
 * `auth.allowedRedirectUris` (https, or a native app's private scheme - never
 * plain http), or - with `allowLoopbackRedirects` - a loopback URI such as
 * `http://127.0.0.1:33418/callback` (RFC 8252 §7.3). Nothing else.
 */
export const isRegistrableRedirectUri = (
  value: string,
  config: Pick<
    ResolvedMcpConfig,
    "allowedRedirectUris" | "allowLoopbackRedirects"
  >,
): boolean => {
  const url = parse(value);
  if (!url) return false;

  if (isLoopback(url)) return config.allowLoopbackRedirects;
  if (url.protocol === "http:") return false;

  return config.allowedRedirectUris.includes(value);
};

/**
 * Whether `requested` is one of the client's registered redirect URIs - and
 * still allowed by the config, which may have changed since it registered.
 *
 * The comparison is exact, except that a loopback URI may name another port
 * (RFC 8252 §7.3: a native app picks a free port each time). Everything else
 * - host, path, query - must match character for character.
 */
export const matchRegisteredRedirectUri = (
  requested: string,
  registered: readonly string[],
  config: Pick<
    ResolvedMcpConfig,
    "allowedRedirectUris" | "allowLoopbackRedirects"
  >,
): null | string => {
  if (!isRegistrableRedirectUri(requested, config)) return null;
  if (registered.includes(requested)) return requested;

  const url = parse(requested);
  if (!url || !isLoopback(url)) return null;

  const withoutPort = (value: URL) =>
    `${value.protocol}//${value.hostname}${value.pathname}${value.search}`;
  const target = withoutPort(url);
  const match = registered.some(candidate => {
    const parsed = parse(candidate);

    return (
      parsed !== null && isLoopback(parsed) && withoutPort(parsed) === target
    );
  });

  return match ? requested : null;
};
