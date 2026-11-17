import type { MiddlewareHandler } from "hono";

import { retryAfterSeconds } from "../lib/site-status";

/**
 * Answers `503 { error: "site_offline" }` while the site is offline, unless
 * the caller may use the offline site (see `canBypassSiteOffline`) or the
 * request is under `/admin/` (which requires an AdminCP session anyway). `buildRoute` adds it to every
 * route that does not set `allowWhenOffline`.
 */
export const siteOfflineGuard = (): MiddlewareHandler => async (c, next) => {
  if (c.req.path.includes("/admin/")) return await next();

  // Loaded lazily: the status module reaches the route builders, which
  // import this guard.
  const { canBypassSiteOffline, loadSiteStatus } =
    await import("../lib/site-status.server");
  let status: Awaited<ReturnType<typeof loadSiteStatus>>;
  try {
    status = await loadSiteStatus(c);
  } catch {
    // An unreadable status counts as online: the lookup failing must not
    // take every route down with it.
    return await next();
  }
  if (!status.offline || (await canBypassSiteOffline(c))) return await next();

  const retryAfter = retryAfterSeconds(status.opensAt);
  if (retryAfter) c.header("Retry-After", String(retryAfter));
  c.header("Cache-Control", "no-store");

  return c.json({ error: "site_offline" }, 503);
};
