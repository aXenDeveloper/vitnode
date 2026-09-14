import type { PluginRouteTranslator } from "@/routing";

import type { AdminScreenContext } from "../screen";

import { requireAdminPermission } from "../screen";
import { searchIndexQuery } from "./query";

/**
 * `/admin/core/advanced/search`, as everything a TanStack Start route needs and
 * nothing a route owns.
 */

export const ADMIN_SEARCH_INDEX_NAMESPACES = [
  "core.global",
  "core.search",
] as const;

/** What {@link loadAdminSearchIndexRoute} returns - and what `head` receives. */
export interface AdminSearchIndexRouteData {
  description: string;
  title: string;
}

const SEARCH_INDEX_PERMISSION = {
  module: "system",
  permission: "can_view",
} as const;

export const loadAdminSearchIndexRoute = async ({
  adminAccess,
  queryClient,
  t,
}: AdminScreenContext & {
  t: PluginRouteTranslator;
}): Promise<AdminSearchIndexRouteData> => {
  requireAdminPermission(adminAccess, SEARCH_INDEX_PERMISSION);

  await queryClient.query({
    ...searchIndexQuery(),
    staleTime: "static",
  });

  return {
    description: t("core.search.admin.desc"),
    title: t("core.search.admin.title"),
  };
};
