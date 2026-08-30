import type { QueryClient } from "@tanstack/react-query";

import { intlQueryOptions } from "../i18n/query";
import { middlewareConfigQueryOptions } from "./middleware-config";

/** What the SSO callback screens render strings from. */
export const SSO_CALLBACK_NAMESPACES = [
  "core.global",
  "core.auth.sso",
] as const;

/**
 * The provider names, and the strings the screens render.
 *
 * The provider list is what turns `google` in the URL into "Google" on the
 * conflict screen. It is the same cache entry the login page warmed, so arriving
 * here from a client-side navigation costs nothing.
 *
 * No session read and no guard: by the time a provider redirects back, the API
 * has already minted its `--state-sso` cookie and the visitor may well have been
 * signed in by a parallel tab. An unfinished flow is finished here, whoever is
 * asking.
 */
export const loadSsoCallbackRoute = async ({
  locale,
  queryClient,
}: {
  locale: string;
  queryClient: QueryClient;
}): Promise<void> => {
  await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: SSO_CALLBACK_NAMESPACES }),
    ),
    queryClient.ensureQueryData(middlewareConfigQueryOptions()),
  ]);
};
