import type { QueryClient } from "@tanstack/react-query";
import type { z } from "zod";

import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import type { routeMiddlewareSchema } from "@/api/modules/middleware/route";
import type { SSOProvider } from "@/views/auth/sso/providers";

import { CONFIG_PLUGIN } from "@/config";
import { fetcher } from "@/tanstack/fetcher";
import { normalizeSSOProviders } from "@/views/auth/sso/providers";

export type MiddlewareConfig = z.infer<typeof routeMiddlewareSchema>;

export interface MiddlewareConfigState extends MiddlewareConfig {
  isDeferred: boolean;
  isKnown: boolean;
}

export const UNKNOWN_MIDDLEWARE_CONFIG: MiddlewareConfigState = Object.freeze({
  ai: { models: [] },
  isDeferred: false,
  isEmail: false,
  isKnown: false,
  navigation: [],
  passkeys: false,
  password: true,
  bottomBar: [],
  sso: [],
});

export const DEFERRED_MIDDLEWARE_CONFIG: MiddlewareConfigState = Object.freeze({
  ...UNKNOWN_MIDDLEWARE_CONFIG,
  isDeferred: true,
});

/** The API's answer, marked as one. */
export const knownMiddlewareConfig = (
  config: MiddlewareConfig,
): MiddlewareConfigState => ({ ...config, isDeferred: false, isKnown: true });

const fetchMiddlewareConfig = async (): Promise<MiddlewareConfigState> => {
  try {
    const response = await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      method: "get",
      module: "middleware",
      path: "/",
    });

    if (response.status !== 200) return UNKNOWN_MIDDLEWARE_CONFIG;

    return knownMiddlewareConfig(await response.json());
  } catch (error) {
    // oxlint-disable-next-line no-console
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
    refetchOnMount: query => (query.state.data?.isKnown ? true : "always"),
    staleTime: query => (query.state.data?.isKnown ? MIDDLEWARE_STALE_TIME : 0),
  });

export const loadMiddlewareConfig = async (
  queryClient: QueryClient,
): Promise<MiddlewareConfigState> =>
  await queryClient.query({
    ...middlewareConfigQueryOptions(),
    staleTime: query => (query.state.data?.isKnown ? "static" : 0),
  });

export class MiddlewareConfigUnknownError extends Error {
  constructor() {
    super("The deployment configuration could not be read.");
    this.name = "MiddlewareConfigUnknownError";
  }
}

export const useMiddlewareConfigQuery = () =>
  useSuspenseQuery(middlewareConfigQueryOptions());

export const invalidateMiddlewareConfig = async (
  queryClient: QueryClient,
): Promise<void> =>
  await queryClient.invalidateQueries({ queryKey: MIDDLEWARE_QUERY_KEY });

export const ssoProvidersOf = (config: MiddlewareConfig): SSOProvider[] =>
  normalizeSSOProviders(config.sso);

export interface AuthMethods {
  passkey: boolean;
  password: boolean;
  resetPassword: boolean;
  signUp: boolean;
  sso: SSOProvider[];
}

export const authMethodsOf = (config: MiddlewareConfig): AuthMethods => {
  const sso = ssoProvidersOf(config);

  return {
    passkey: config.passkeys,
    password: config.password,
    resetPassword: config.password && config.isEmail,
    signUp: config.password || sso.length > 0,
    sso,
  };
};

export const hasSignInMethod = (methods: AuthMethods): boolean =>
  methods.password || methods.passkey || methods.sso.length > 0;
