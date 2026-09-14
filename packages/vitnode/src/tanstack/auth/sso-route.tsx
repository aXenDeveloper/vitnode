import type { QueryClient } from "@tanstack/react-query";

import { middlewareConfigQueryOptions } from "./middleware-config";

/** What the SSO callback screens render strings from. */
export const SSO_CALLBACK_NAMESPACES = [
  "core.global",
  "core.auth.sso",
] as const;

/**
 * The deployment configuration the callback needs to finish a sign-in.
 *
 * The strings are not fetched here: the route declares
 * {@link SSO_CALLBACK_NAMESPACES} in `messages`, so the runtime warms them
 * before this runs.
 */
export const loadSsoCallbackRoute = async ({
  queryClient,
}: {
  queryClient: QueryClient;
}): Promise<void> => {
  await queryClient.query({
    ...middlewareConfigQueryOptions(),
    staleTime: "static",
  });
};
