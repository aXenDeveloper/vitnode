/** HTTP status the API replies with when a client exceeds the rate limit. */
export const RATE_LIMIT_STATUS = 429;

/**
 * DOM event dispatched on `window` when a client-side request is rate-limited,
 * so a globally-mounted listener can inform the user without the fetcher having
 * to know about React, i18n or the toaster.
 */
export const RATE_LIMIT_EVENT = "vitnode:rate-limit";

export interface RateLimitEventDetail {
  /** Seconds to wait before retrying, parsed from the `Retry-After` header. */
  retryAfter?: number;
}

export const isRateLimited = (response: { status: number }): boolean =>
  response.status === RATE_LIMIT_STATUS;

const parseRetryAfter = (response: Response): number | undefined => {
  const header = response.headers.get("Retry-After");
  if (!header) return undefined;

  const seconds = Number(header);

  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
};

/**
 * Broadcasts a rate-limit event so a globally-mounted listener can inform the
 * user. No-op on the server, where there is no `window` to dispatch on.
 */
export const notifyRateLimited = (response: Response): void => {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<RateLimitEventDetail>(RATE_LIMIT_EVENT, {
      detail: { retryAfter: parseRetryAfter(response) },
    }),
  );
};
