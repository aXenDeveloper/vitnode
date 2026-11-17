import type { SiteStatus } from "@vitnode/api/lib/site-status";

/**
 * Pages every visitor can open while the site is offline, so staff can sign
 * in: `/login` and everything below it (password reset, e-mail
 * verification, SSO callbacks). Internal paths, without a locale prefix.
 */
export const SITE_OFFLINE_OPEN_PATHS = ["/login"] as const;

/** Whether `pathname` (internal) stays open while the site is offline. */
export const isSiteOfflineOpenPath = (pathname: string): boolean =>
  SITE_OFFLINE_OPEN_PATHS.some(
    path => pathname === path || pathname.startsWith(`${path}/`),
  );

/**
 * Whether this viewer keeps using the site while it is offline: the API says
 * so for admins and for moderators with the "Access the site while it's
 * offline" staff permission.
 */
export const isSiteOfflineBypass = (
  status: Pick<SiteStatus, "offline" | "viewerCanBypass"> | undefined,
): boolean => !!status?.offline && status.viewerCanBypass;

/**
 * Whether this visitor gets the offline page instead of `pathname`: the site
 * is offline, they may not bypass it, and the page is not one of
 * {@link SITE_OFFLINE_OPEN_PATHS}.
 */
export const isSiteClosedTo = ({
  pathname,
  status,
}: {
  pathname: string;
  status: Pick<SiteStatus, "offline" | "viewerCanBypass"> | undefined;
}): boolean =>
  !!status?.offline &&
  !status.viewerCanBypass &&
  !isSiteOfflineOpenPath(pathname);
