/**
 * The request state a VitNode frontend forwards to the API - and nothing else.
 *
 * Deliberately an allowlist rather than a copy of the incoming headers. The API
 * identifies the caller from `Cookie`, fingerprints their device from
 * `user-agent`, and keys rate limiting and the audit trail off
 * `x-forwarded-for`, so those three have to survive the hop. Everything else a
 * browser or a proxy attached must not: `host` and `content-length` describe a
 * different request than the one being made, and `origin`, `referer` or
 * `authorization` would let a visitor hand the API state it trusts.
 *
 * Lives here, framework-free, because two frontends need the same contract -
 * {@link fetcher} reads the request through `next/headers`, a TanStack Start app
 * reads it through `@tanstack/react-start/server`. Only the reading differs;
 * what gets sent must not.
 */

/** Header the captcha middleware reads the client's solved token from. */
export const CAPTCHA_TOKEN_HEADER = "x-vitnode-captcha-token";

/** Sent when no forwarded IP is known, so the API never has to handle an empty one. */
export const FORWARDED_IP_FALLBACK = "0.0.0.0";

/**
 * Sent when the caller has no `user-agent`, which is the normal case for a
 * server-to-server call. Matches the API's own fallback, so `parseUserAgent`
 * reports "Unknown" instead of inventing a browser.
 */
export const FORWARDED_USER_AGENT_FALLBACK = "node";

export interface ForwardedRequestContext {
  /** Solved captcha token, when the route being called requires one. */
  captchaToken?: string;
  /** The caller's full `Cookie` header - the session and device cookies live here. */
  cookie?: null | string;
  /**
   * The caller's IP, or the `x-forwarded-for` chain verbatim when the frontend
   * itself sits behind a proxy. Only meaningful when that proxy is trusted; the
   * API stores whatever arrives.
   */
  forwardedFor?: null | string;
  userAgent?: null | string;
}

export const buildForwardedHeaders = ({
  captchaToken,
  cookie,
  forwardedFor,
  userAgent,
}: ForwardedRequestContext): Record<string, string> => {
  const headers: Record<string, string> = {
    Cookie: cookie ?? "",
    "user-agent": userAgent ?? FORWARDED_USER_AGENT_FALLBACK,
    "x-forwarded-for": forwardedFor ?? FORWARDED_IP_FALLBACK,
  };

  if (captchaToken) {
    headers[CAPTCHA_TOKEN_HEADER] = captchaToken;
  }

  return headers;
};
