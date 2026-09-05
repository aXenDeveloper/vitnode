import type { QueryClient } from "@tanstack/react-query";

import { intlQueryOptions } from "../i18n/query";
import { middlewareConfigQueryOptions } from "./middleware-config";

/** What the SSO callback screens render strings from. */
export const SSO_CALLBACK_NAMESPACES = [
  "core.global",
  "core.auth.sso",
] as const;

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
