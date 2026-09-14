import type { QueryClient } from "@tanstack/react-query";

import { intlQueryOptions } from "../i18n/query";
import { passwordResetNamespaces } from "./recovery";

/** What {@link loadPasswordResetRoute} returns. */
export interface PasswordResetRouteData {
  namespaces: readonly string[];
}

/**
 * Warms the namespaces this screen renders, which depend on the mode the URL is
 * asking for - the change-password form has copy the request form does not.
 *
 * The route's *title* is not here: it lives in `core.auth.reset_password`, which
 * both modes declare, so `head` translates it directly.
 */
export const loadPasswordResetRoute = async ({
  locale,
  mode,
  queryClient,
}: {
  locale: string;
  mode: "change" | "request";
  queryClient: QueryClient;
}): Promise<PasswordResetRouteData> => {
  const namespaces = passwordResetNamespaces(mode);

  await queryClient.query({
    ...intlQueryOptions({ locale, namespaces }),
    staleTime: "static",
  });

  return { namespaces };
};
