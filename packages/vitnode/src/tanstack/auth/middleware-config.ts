import type { QueryClient } from "@tanstack/react-query";
import type { z } from "zod";

import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import type { routeMiddlewareSchema } from "@/api/modules/middleware/route";
import type { SSOProvider } from "@/views/auth/sso/providers";

import { manifest } from "@/manifest";
import { fetcher } from "@/tanstack/fetcher";
import { normalizeSSOProviders } from "@/views/auth/sso/providers";

/** The deployment's public configuration: enabled sign-in methods, SSO providers, email and AI availability, and the captcha provider. */
export type MiddlewareConfig = z.infer<typeof routeMiddlewareSchema>;

export interface MiddlewareConfigState extends MiddlewareConfig {
  isDeferred: boolean;
  /**
   * `false` when the API could not be read; the other fields then hold safe
   * defaults (password sign-in only) and the query refetches on the next mount.
   */
  isKnown: boolean;
}

export const UNKNOWN_MIDDLEWARE_CONFIG: MiddlewareConfigState = Object.freeze({
  ai: { models: [] },
  isDeferred: false,
  isEmail: false,
  isKnown: false,
  passkeys: false,
  password: true,
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
      plugin: manifest.id,
      method: "get",
      module: "middleware",
      path: "/",
    });

    if (response.status !== 200) return UNKNOWN_MIDDLEWARE_CONFIG;

    const config = await response.json();
    return knownMiddlewareConfig(config);
  } catch (error) {
    // oxlint-disable-next-line no-console
    console.error("[auth] middleware configuration unavailable", error);

    return UNKNOWN_MIDDLEWARE_CONFIG;
  }
};

/** Everything a middleware-configuration cache entry's key starts with. */
export const MIDDLEWARE_QUERY_KEY = ["vitnode", "middleware"] as const;

/**
 * The deployment configuration as a TanStack Query. A successful answer is
 * cached for the life of the page; a failed one resolves to defaults with
 * `isKnown: false` (it never rejects) and is retried on the next mount.
 */
export const middlewareConfigQueryOptions = () =>
  queryOptions({
    gcTime: Infinity,
    queryFn: async () => await fetchMiddlewareConfig(),
    queryKey: MIDDLEWARE_QUERY_KEY,
    refetchOnMount: query => (query.state.data?.isKnown ? true : "always"),
    staleTime: query => (query.state.data?.isKnown ? Infinity : 0),
  });

/** Loads the deployment configuration in a route loader, reusing a known answer. */
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

/**
 * The deployment configuration in a component - which sign-in methods and SSO
 * providers exist, whether email or AI is set up. Suspends until loaded, so
 * render it under a `Suspense` boundary or warm it with
 * {@link loadMiddlewareConfig}.
 */
export const useMiddlewareConfigQuery = () =>
  useSuspenseQuery(middlewareConfigQueryOptions());

/** Refetches the deployment configuration, e.g. after an admin changes it. */
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

/** Which sign-in, sign-up and recovery methods the deployment offers. */
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
