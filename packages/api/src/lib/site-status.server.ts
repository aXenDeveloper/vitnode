import type { Context } from "hono";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { defineCacheEntry } from "@/builders";
import { zodRichTextDocument } from "@/content/rich-text/document";
import { core_site_status } from "@/database/site";

import type { DomainCache } from "./cache";
import type { SiteOfflineMessage, SiteStatusUpdate } from "./site-status";

import {
  checkStaffPermissionOfUser,
  getStaffFlags,
} from "./check-staff-permission";
import { coreStaffPermissions } from "./core-staff-permissions";
import { invalidatePageCacheTags } from "./page-cache";
import { SITE_STATUS_PAGE_CACHE_TAG } from "./site-status";
import { staffPermissionArgs } from "./staff-permissions";

/** The stored row, as every request reads it. */
export interface StoredSiteStatus {
  changedAt: null | string;
  changedById: null | number;
  message: SiteOfflineMessage;
  offline: boolean;
  opensAt: null | string;
  showCountdown: boolean;
}

const ONLINE: StoredSiteStatus = {
  changedAt: null,
  changedById: null,
  message: [],
  offline: false,
  opensAt: null,
  showCountdown: true,
};

/**
 * Every request reads it, so it is cached. A save deletes the entry; the TTL
 * only bounds how long another instance without a shared store lags behind.
 */
const siteStatusCache = defineCacheEntry({
  name: "site.status",
  version: 1,
  schema: z.object({
    changedAt: z.string().nullable(),
    changedById: z.number().int().nullable(),
    /** JSON of the message: rich-text attrs are not typed as JSON. */
    message: z.string(),
    offline: z.boolean(),
    opensAt: z.string().nullable(),
    showCountdown: z.boolean(),
  }),
  ttlSeconds: 300,
});

const zodMessage = z.array(
  z.object({ languageCode: z.string(), value: zodRichTextDocument }),
);

const parseMessage = (json: string): SiteOfflineMessage =>
  zodMessage.parse(JSON.parse(json));

/** Test apps built without the global middleware have no cache. */
const cacheOf = (c: Context) => c.get("cache") as DomainCache | undefined;

const perRequest = new WeakMap<Context, Promise<StoredSiteStatus>>();

const readRow = async (c: Context): Promise<StoredSiteStatus> => {
  const [row] = await c
    .get("db")
    .select()
    .from(core_site_status)
    .where(eq(core_site_status.id, 1))
    .limit(1);
  if (!row) return ONLINE;

  return {
    changedAt: row.changedAt.toISOString(),
    changedById: row.changedById,
    message: row.message,
    offline: row.offline,
    opensAt: row.opensAt?.toISOString() ?? null,
    showCountdown: row.showCountdown,
  };
};

/**
 * The site status, read once per request and shared across requests through
 * the cache. A missing row means online. Server-only.
 */
export const loadSiteStatus = async (c: Context): Promise<StoredSiteStatus> => {
  const remembered = perRequest.get(c);
  if (remembered) return await remembered;

  const cache = cacheOf(c);
  const loading = cache
    ? cache
        .entry(siteStatusCache)
        .remember(async () => {
          const row = await readRow(c);

          return { ...row, message: JSON.stringify(row.message) };
        })
        .then(cached => ({ ...cached, message: parseMessage(cached.message) }))
    : readRow(c);
  perRequest.set(c, loading);

  return await loading;
};

/**
 * Whether the request may use the site while it is offline: an AdminCP
 * session, an admin, or a moderator holding
 * `coreStaffPermissions.moderator.site_status.canAccessOffline` (a root role
 * holds it too). Server-only.
 */
export const canBypassSiteOffline = async (c: Context): Promise<boolean> => {
  if (c.get("admin")) return true;
  const user = c.get("user");
  if (!user) return false;

  const { isAdmin, isModerator } = await getStaffFlags(c, user);
  if (isAdmin) return true;
  if (!isModerator) return false;

  return await checkStaffPermissionOfUser(c, user, {
    type: "moderator",
    ...staffPermissionArgs(
      coreStaffPermissions.moderator.site_status.canAccessOffline,
    ),
  });
};

/**
 * Writes the site status and returns the row before the write (`null` when
 * there was none). Run it inside the caller's transaction, then call
 * {@link afterSiteStatusSaved} once it has committed. Server-only.
 */
export const saveSiteStatus = async (
  tx: Omit<Context["var"]["db"], "$client">,
  body: SiteStatusUpdate,
  userId: number,
): Promise<{
  before: null | typeof core_site_status.$inferSelect;
  switched: boolean;
}> => {
  const [before] = await tx
    .select()
    .from(core_site_status)
    .where(eq(core_site_status.id, 1))
    .limit(1)
    .for("update");
  const switched = (before?.offline ?? false) !== body.offline;
  const values = {
    message: body.message,
    offline: body.offline,
    opensAt: body.opensAt ? new Date(body.opensAt) : null,
    showCountdown: body.showCountdown,
    ...(switched || !before
      ? { changedAt: new Date(), changedById: userId }
      : {}),
  };

  await tx
    .insert(core_site_status)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ set: values, target: core_site_status.id });

  return { before: before ?? null, switched };
};

/**
 * Expires every copy of the site status: the shared cache entry and every
 * cached page that read it. Call it after the save has committed.
 */
export const afterSiteStatusSaved = async (c: Context): Promise<void> => {
  perRequest.delete(c);
  await cacheOf(c)?.entry(siteStatusCache).delete();
  await invalidatePageCacheTags([SITE_STATUS_PAGE_CACHE_TAG], {
    mode: "hard",
  });
};
