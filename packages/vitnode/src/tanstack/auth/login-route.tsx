import type { QueryClient } from "@tanstack/react-query";

import { middlewareConfigQueryOptions } from "./middleware-config";

export const LOGIN_NAMESPACES = [
  "core.global",
  "core.auth.sign_in",
  "core.auth.sso",
] as const;

/** The narrowest slice of a route's context these loaders read. */
export interface AuthLoaderContext {
  locale: string;
  queryClient: QueryClient;
}

/**
 * What both auth cards need before they render: the deployment's middleware
 * configuration, which decides which SSO buttons exist.
 *
 * The title is no longer here - it is one string from `core.global`, and `head`
 * translates it directly now that the route declares its namespaces.
 */
export const loadAuthCard = async ({
  queryClient,
}: AuthLoaderContext): Promise<void> => {
  await queryClient.query({
    ...middlewareConfigQueryOptions(),
    staleTime: "static",
  });
};

export const loadLoginRoute = loadAuthCard;
