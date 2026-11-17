import type { SiteStatus } from "@vitnode/api/lib/site-status";

import type { SessionApi } from "../auth/session-api";

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

/** Whether the session belongs to staff (admin or moderator), who keep using an offline site. */
export const isSiteOfflineBypass = (
  session: null | SessionApi | undefined,
): boolean =>
  !!session?.user && (session.user.isAdmin || session.user.isModerator);

/**
 * Whether this visitor gets the offline page instead of `pathname`: the site
 * is offline, they are not staff, and the page is not one of
 * {@link SITE_OFFLINE_OPEN_PATHS}.
 */
export const isSiteClosedTo = ({
  pathname,
  session,
  status,
}: {
  pathname: string;
  session: null | SessionApi | undefined;
  status: Pick<SiteStatus, "offline"> | undefined;
}): boolean =>
  !!status?.offline &&
  !isSiteOfflineBypass(session) &&
  !isSiteOfflineOpenPath(pathname);
