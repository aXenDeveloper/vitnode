import type { z } from "zod";

import { queryOptions } from "@tanstack/react-query";

import type { middlewareModule } from "@/api/modules/middleware/middleware.module";
import type { routeMiddlewareSchema } from "@/api/modules/middleware/route";
import type { SSOProvider } from "@/views/auth/sso/providers";

import { clientModule } from "@/lib/fetcher-client";
import { fetcher } from "@/tanstack/fetcher";
import { normalizeSSOProviders } from "@/views/auth/sso/providers";

export type MiddlewareConfig = z.infer<typeof routeMiddlewareSchema>;

export interface MiddlewareConfigState extends MiddlewareConfig {
  isKnown: boolean;
}

export const UNKNOWN_MIDDLEWARE_CONFIG: MiddlewareConfigState = Object.freeze({
  isEmail: false,
  isKnown: false,
  sso: [],
});

/** The API's answer, marked as one. */
export const knownMiddlewareConfig = (
  config: MiddlewareConfig,
): MiddlewareConfigState => ({ ...config, isKnown: true });

const middleware = clientModule<typeof middlewareModule>("@vitnode/core");

const fetchMiddlewareConfig = async (): Promise<MiddlewareConfigState> => {
  try {
    const response = await fetcher(middleware, {
      method: "get",
      module: "middleware",
      path: "/",
    });

    if (response.status !== 200) return UNKNOWN_MIDDLEWARE_CONFIG;

    return knownMiddlewareConfig(await response.json());
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[auth] middleware configuration unavailable", error);

    return UNKNOWN_MIDDLEWARE_CONFIG;
  }
};

/** Everything a middleware-configuration cache entry's key starts with. */
const MIDDLEWARE_QUERY_KEY = ["vitnode", "middleware"] as const;

const MIDDLEWARE_STALE_TIME = 300_000;

export const middlewareConfigQueryOptions = () =>
  queryOptions({
    queryFn: async () => await fetchMiddlewareConfig(),
    queryKey: MIDDLEWARE_QUERY_KEY,
    staleTime: MIDDLEWARE_STALE_TIME,
  });

export const ssoProvidersOf = (config: MiddlewareConfig): SSOProvider[] =>
  normalizeSSOProviders(config.sso);
