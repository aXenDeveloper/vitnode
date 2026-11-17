import type { QueryClient } from "@tanstack/react-query";

import { sessionQueryOptions } from "../auth/session-query";
import { intlQueryOptions } from "../i18n/query";
import { isSiteClosedTo } from "./access";
import { siteStatusQueryOptions } from "./query";
import { markSiteOfflineResponse } from "./response";

/** The strings of the offline page and the staff banner. */
export const SITE_OFFLINE_NAMESPACES = ["core.site_offline", "core.global"];

/**
 * Warms the site status for the shell and, when this visitor gets the offline
 * page, answers the request with `503`. Call it after the session is loaded
 * (a shared render has none, so it is treated as a guest). A status that
 * fails to load counts as online: an API hiccup never takes the site down.
 */
export const loadSiteStatusGate = async (
  { locale, queryClient }: { locale: string; queryClient: QueryClient },
  pathname: string,
): Promise<void> => {
  const status = await queryClient
    .query(siteStatusQueryOptions())
    .catch(() => undefined);
  if (!status?.offline) return;

  await queryClient.query({
    ...intlQueryOptions({ locale, namespaces: SITE_OFFLINE_NAMESPACES }),
    staleTime: "static",
  });

  const session = queryClient.getQueryData(sessionQueryOptions().queryKey);
  if (isSiteClosedTo({ pathname, session, status })) {
    markSiteOfflineResponse(status.opensAt);
  }
};
