import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFERRED_MIDDLEWARE_CONFIG,
  knownMiddlewareConfig,
  loadMiddlewareConfig,
  middlewareConfigQueryOptions,
  type MiddlewareConfigState,
  UNKNOWN_MIDDLEWARE_CONFIG,
} from "./middleware-config";

const { queryKey } = middlewareConfigQueryOptions();

const seeded = (data: MiddlewareConfigState) => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(queryKey, data);

  return queryClient;
};

const fetchesOf = (queryClient: QueryClient) =>
  queryClient.getQueryState(queryKey)?.dataUpdateCount;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadMiddlewareConfig", () => {
  it("asks the API again instead of trusting a cached fallback", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const queryClient = seeded(UNKNOWN_MIDDLEWARE_CONFIG);

    await loadMiddlewareConfig(queryClient);

    expect(fetchesOf(queryClient)).toBe(2);
  });

  it("serves a known configuration from the cache", async () => {
    const known = knownMiddlewareConfig({
      ai: { models: [] },
      bottomBar: [],
      isEmail: true,
      navigation: [],
      passkeys: false,
      password: true,
      sso: [],
    });
    const queryClient = seeded(known);

    const config = await loadMiddlewareConfig(queryClient);

    expect(fetchesOf(queryClient)).toBe(1);
    expect(config).toEqual(known);
  });
});

describe("middlewareConfigQueryOptions", () => {
  const isStale = (data: MiddlewareConfigState) =>
    new QueryObserver(
      seeded(data),
      middlewareConfigQueryOptions(),
    ).getCurrentResult().isStale;

  it("asks again as soon as a page shipped without the configuration", () => {
    expect(isStale(DEFERRED_MIDDLEWARE_CONFIG)).toBe(true);
  });

  it("asks again after the API could not answer", () => {
    expect(isStale(UNKNOWN_MIDDLEWARE_CONFIG)).toBe(true);
  });

  it("keeps a known configuration fresh", () => {
    expect(
      isStale(
        knownMiddlewareConfig({
          ai: { models: [] },
          bottomBar: [],
          isEmail: true,
          navigation: [],
          passkeys: false,
          password: true,
          sso: [],
        }),
      ),
    ).toBe(false);
  });
});
