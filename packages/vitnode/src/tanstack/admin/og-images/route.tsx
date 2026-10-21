import type { PluginRouteTranslator } from "@/routing";

import { ogImageTemplatesQueryOptions } from "@/views/admin/views/core/seo/og-images/og-images-query";

import type { AdminScreenContext } from "../screen";

import { requireAdminPermission } from "../screen";

/**
 * `/admin/core/seo/og-images`, as everything a TanStack Start route needs and
 * nothing a route owns.
 */

export const ADMIN_OG_IMAGES_NAMESPACES = [
  "admin.seo.og_images",
  "core.global",
] as const;

/** What {@link loadAdminOgImagesRoute} returns - and what `head` receives. */
export interface AdminOgImagesRouteData {
  description: string;
  title: string;
}

export const SEO_VIEW_PERMISSION = {
  module: "seo",
  permission: "can_view",
} as const;

export const loadAdminOgImagesRoute = async ({
  adminAccess,
  queryClient,
  t,
}: AdminScreenContext & {
  t: PluginRouteTranslator;
}): Promise<AdminOgImagesRouteData> => {
  requireAdminPermission(adminAccess, SEO_VIEW_PERMISSION);

  await queryClient.query({
    ...ogImageTemplatesQueryOptions(),
    staleTime: "static",
  });

  return {
    description: t("admin.seo.og_images.desc"),
    title: t("admin.seo.og_images.title"),
  };
};
