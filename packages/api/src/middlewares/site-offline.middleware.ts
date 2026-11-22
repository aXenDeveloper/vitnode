import type { MiddlewareHandler } from "hono";

import { isAdminApiPath } from "../lib/route-metadata";
import { retryAfterSeconds } from "../lib/site-status";
import {
  canBypassSiteOffline,
  loadSiteStatus,
} from "../lib/site-status.server";

/**
 * Answers `503 { error: "site_offline" }` while the site is offline, unless
 * the caller may use the offline site (see `canBypassSiteOffline`) or the
 * request is under `/admin/` (which requires an AdminCP session anyway). A
 * status that fails to load counts as online, so the lookup never takes every
 * route down with it. `buildRoute` adds it to every route that does not set
 * `allowWhenOffline`.
 */
export const siteOfflineGuard: MiddlewareHandler = async (c, next) => {
  if (isAdminApiPath(c.req.path)) return await next();

  const status = await loadSiteStatus(c).catch(() => null);
  if (!status?.offline || (await canBypassSiteOffline(c))) return await next();

  const retryAfter = retryAfterSeconds(status.opensAt);
  if (retryAfter) c.header("Retry-After", String(retryAfter));
  c.header("Cache-Control", "no-store");

  return c.json({ error: "site_offline" }, 503);
};
