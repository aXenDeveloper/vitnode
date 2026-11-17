import type { MiddlewareHandler } from "hono";

/**
 * Answers `503 { error: "site_offline" }` while the site is offline, unless
 * the caller is staff (admin or moderator) or the request is under `/admin/`
 * (which requires an AdminCP session anyway). `buildRoute` adds it to every
 * route that does not set `allowWhenOffline`.
 */
export const siteOfflineGuard = (): MiddlewareHandler => async (c, next) => {
  if (c.req.path.includes("/admin/")) return await next();

  // Loaded lazily: the status module reaches the route builders, which
  // import this guard.
  const { canBypassSiteOffline, loadSiteStatus } =
    await import("../lib/site-status.server");
  let status: Awaited<ReturnType<typeof loadSiteStatus>> | undefined;
  let allowed = true;
  try {
    status = await loadSiteStatus(c);
    allowed = !status.offline || (await canBypassSiteOffline(c));
  } catch {
    // An unreadable status counts as online: the lookup failing must not
    // take every route down with it.
  }
  if (allowed || !status) return await next();

  const seconds = status.opensAt
    ? Math.ceil((Date.parse(status.opensAt) - Date.now()) / 1000)
    : 0;
  if (seconds > 0) c.header("Retry-After", String(seconds));
  c.header("Cache-Control", "no-store");

  return c.json({ error: "site_offline" }, 503);
};
