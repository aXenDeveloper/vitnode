/** Header the captcha middleware reads the client's solved token from. */
export const CAPTCHA_TOKEN_HEADER = "x-vitnode-captcha-token";

/** Sent when no forwarded IP is known, so the API never has to handle an empty one. */
export const FORWARDED_IP_FALLBACK = "0.0.0.0";

export const FORWARDED_USER_AGENT_FALLBACK = "node";

export interface ForwardedRequestContext {
  /** Solved captcha token, when the route being called requires one. */
  captchaToken?: string;
  /** The caller's full `Cookie` header - the session and device cookies live here. */
  cookie?: null | string;

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
