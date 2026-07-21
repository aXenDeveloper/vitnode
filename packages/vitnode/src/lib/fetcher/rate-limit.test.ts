import { afterEach, describe, expect, it, vi } from "vitest";

import type { RateLimitEventDetail } from "./rate-limit";

import {
  isRateLimited,
  notifyRateLimited,
  RATE_LIMIT_EVENT,
  RATE_LIMIT_STATUS,
} from "./rate-limit";

const buildResponse = (status: number, retryAfter?: string): Response =>
  new Response(null, {
    status,
    headers: retryAfter ? { "Retry-After": retryAfter } : undefined,
  });

describe("isRateLimited", () => {
  it("returns true for a 429 response", () => {
    expect(isRateLimited({ status: RATE_LIMIT_STATUS })).toBe(true);
  });

  it("returns false for other statuses", () => {
    expect(isRateLimited({ status: 200 })).toBe(false);
    expect(isRateLimited({ status: 500 })).toBe(false);
  });
});

describe("notifyRateLimited", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dispatches a rate-limit event with the parsed Retry-After seconds", () => {
    const details: (RateLimitEventDetail | undefined)[] = [];
    const handler = (event: Event) => {
      details.push((event as CustomEvent<RateLimitEventDetail>).detail);
    };
    window.addEventListener(RATE_LIMIT_EVENT, handler);

    notifyRateLimited(buildResponse(RATE_LIMIT_STATUS, "30"));

    window.removeEventListener(RATE_LIMIT_EVENT, handler);
    expect(details).toHaveLength(1);
    expect(details[0]?.retryAfter).toBe(30);
  });

  it("omits retryAfter when the header is missing or invalid", () => {
    const details: (RateLimitEventDetail | undefined)[] = [];
    const handler = (event: Event) => {
      details.push((event as CustomEvent<RateLimitEventDetail>).detail);
    };
    window.addEventListener(RATE_LIMIT_EVENT, handler);

    notifyRateLimited(buildResponse(RATE_LIMIT_STATUS));
    notifyRateLimited(buildResponse(RATE_LIMIT_STATUS, "not-a-number"));

    window.removeEventListener(RATE_LIMIT_EVENT, handler);
    expect(details.map(d => d?.retryAfter)).toEqual([undefined, undefined]);
  });

  it("is a no-op on the server (no window)", () => {
    const original = globalThis.window;
    // @ts-expect-error - simulate a server environment without `window`
    delete globalThis.window;

    expect(() =>
      notifyRateLimited(buildResponse(RATE_LIMIT_STATUS, "10")),
    ).not.toThrow();

    globalThis.window = original;
  });
});
