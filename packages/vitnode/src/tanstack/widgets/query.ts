import { queryOptions } from "@tanstack/react-query";

import type {
  EditablePageLayoutPayload,
  EditablePageSavePayload,
} from "@/content/editor";

import { CONFIG_PLUGIN } from "@/config";
import { EditablePageSaveRefused } from "@/content/editor";
import { OPERATIONAL_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";

export interface ModeratorPermissions {
  permissions: readonly {
    module: string;
    permission: string;
    plugin: string;
  }[];
  root: boolean;
}

/**
 * The envelope alone, because every node inside it is checked again where it is
 * rendered: the public renderer skips a block whose data does not match its
 * fields, and the API validated all of them against the zone's own allowlist
 * before storing anything. Re-parsing the whole document here would buy nothing
 * and put a schema library in the chunk of a page that only reads it.
 */
const isLayoutPayload = (value: unknown): value is EditablePageLayoutPayload =>
  typeof value === "object" &&
  value !== null &&
  "pageId" in value &&
  typeof value.pageId === "string" &&
  "updatedAt" in value &&
  (typeof value.updatedAt === "string" || value.updatedAt === null) &&
  "zones" in value &&
  typeof value.zones === "object" &&
  value.zones !== null &&
  Object.values(value.zones).every(zone => Array.isArray(zone));

export const pageLayoutQueryKey = (pageId: string) =>
  ["vitnode", "pages", "layout", pageId] as const;

/**
 * One registered page's effective layout, or `null` when it could not be read.
 *
 * `null` rather than a rejection, and rather than an empty layout: "nothing is
 * stored" and "I could not read what is stored" must never look alike, because
 * the second one renders no zones *and* withholds the editor. A page that put
 * plausible blocks in place of a failed read would offer to save them over
 * whatever is really there.
 */
export const pageLayoutQueryOptions = (pageId: string) =>
  queryOptions({
    queryFn: async (): Promise<EditablePageLayoutPayload | null> => {
      const response = await fetcher({
        plugin: CONFIG_PLUGIN.pluginId,
        method: "get",
        module: "pages",
        path: "/layout",
        args: { query: { pageId } },
      });

      if (!response.ok) return null;

      const body: unknown = await response.json();

      return isLayoutPayload(body) ? body : null;
    },
    queryKey: pageLayoutQueryKey(pageId),
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });

export const moderatorPermissionsQueryKey = () =>
  ["vitnode", "users", "permissions", "moderator"] as const;

export const moderatorPermissionsQueryOptions = () =>
  queryOptions({
    queryFn: async (): Promise<ModeratorPermissions> => {
      const response = await fetcher({
        plugin: CONFIG_PLUGIN.pluginId,
        method: "get",
        module: "users",
        path: "/permissions",
      });

      if (!response.ok) return { permissions: [], root: false };

      return await response.json();
    },
    queryKey: moderatorPermissionsQueryKey(),
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });

/** A root role holds everything and lists nothing, so it counts as yes alone. */
export const holdsPagePermission = (
  held: ModeratorPermissions | undefined,
  wanted: { module: string; permission: string; plugin: string },
): boolean =>
  held?.root === true ||
  (held?.permissions.some(
    entry =>
      entry.plugin === wanted.plugin &&
      entry.module === wanted.module &&
      entry.permission === wanted.permission,
  ) ??
    false);

const refusalOf = async (response: Response): Promise<string> => {
  const fallback = `Saving these widgets answered ${response.status}. Nothing was stored, and the editor keeps your changes.`;

  try {
    const body: unknown = await response.json();
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? body.message
        : undefined;

    return typeof message === "string" && message.length > 0
      ? message
      : fallback;
  } catch {
    return fallback;
  }
};

export const savePageLayout = async (
  payload: EditablePageSavePayload,
): Promise<EditablePageLayoutPayload> => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "put",
    module: "pages",
    path: "/layout",
    args: { body: payload },
  });

  if (!response.ok) {
    throw new EditablePageSaveRefused(await refusalOf(response), {
      conflict: response.status === 409,
      pageId: payload.pageId,
    });
  }

  const body: unknown = await response.json();

  if (!isLayoutPayload(body)) {
    throw new EditablePageSaveRefused(
      "The save went through, but the layout route answered with a body that is not a layout, so what is now stored is unknown. Reload the page before editing it again.",
      { pageId: payload.pageId },
    );
  }

  return body;
};

/**
 * Folds a save's answer into the cached layout.
 *
 * The route answers with the submitted zones alone, so the zones nobody touched
 * have to be carried over - and `updatedAt` has to move, because that is what
 * tells the page the layout it is rendering is a new one.
 */
export const mergePageLayout = (
  cached: EditablePageLayoutPayload | null | undefined,
  stored: EditablePageLayoutPayload,
): EditablePageLayoutPayload => ({
  ...stored,
  zones: { ...cached?.zones, ...stored.zones },
});
