import type { SiteStatus } from "@vitnode/api/lib/site-status";

import { queryOptions } from "@tanstack/react-query";
import { manifest } from "@vitnode/api/manifest";

import { fetcher } from "../fetcher";

export type { SiteStatus } from "@vitnode/api/lib/site-status";

/** How often an open offline page asks whether the site is back. */
export const SITE_OFFLINE_POLL_MS = 60_000;

const SITE_STATUS_STALE_TIME = 60_000;

export const siteStatusQueryKey = ["@vitnode/core", "site-status"] as const;

const fetchSiteStatus = async (): Promise<SiteStatus> => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "site",
    path: "/status",
  });
  if (!response.ok) {
    throw new Error(`The site status did not load (${response.status}).`);
  }

  return await response.json();
};

/**
 * Whether the public site is online, as a TanStack Query. While it is offline
 * it also holds the reason per language, the planned opening time and whether
 * this viewer may still use the site (`viewerCanBypass`), and it
 * refetches every minute so an open offline page notices the reopening.
 * Universal.
 *
 * @example
 * ```ts
 * import { siteStatusQueryOptions } from "@vitnode/core/tanstack/site-status";
 *
 * const status = await queryClient.query(siteStatusQueryOptions());
 * if (status.offline) console.log("Closed until", status.opensAt);
 * ```
 */
export const siteStatusQueryOptions = ({
  viewerId = null,
}: {
  /**
   * The signed-in user's id, or `null` for a guest. The answer says whether
   * this viewer may use the offline site, so each viewer gets their own
   * cache entry and signing in fetches it again.
   */
  viewerId?: null | number;
} = {}) =>
  queryOptions({
    queryFn: fetchSiteStatus,
    queryKey: [...siteStatusQueryKey, viewerId ?? "guest"] as const,
    refetchInterval: query =>
      query.state.data?.offline ? SITE_OFFLINE_POLL_MS : false,
    refetchOnWindowFocus: query => query.state.data?.offline === true,
    retry: false,
    staleTime: SITE_STATUS_STALE_TIME,
  });
