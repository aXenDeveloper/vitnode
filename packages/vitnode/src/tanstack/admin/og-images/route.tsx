import type { PluginRouteTranslator } from "@/routing";

import { ogImagesQueryOptions } from "@/views/admin/views/core/seo/og-images/og-images-query";

import type { AdminScreenContext } from "../screen";

import { requireAdminPermission } from "../screen";

/** `/admin/core/seo/og-images`, as everything a TanStack Start route needs. */
export const ADMIN_OG_IMAGES_NAMESPACES = [
  "admin.seo.og_images",
  "core.global",
] as const;

/** What {@link loadAdminOgImagesRoute} returns - and what `head` receives. */
export interface AdminOgImagesRouteData {
  description: string;
  title: string;
}

/** The core plugin's `seo` module, which guards both preview routes. */
export const SEO_MODULE = "seo";

export const loadAdminOgImagesRoute = async ({
  adminAccess,
  queryClient,
  t,
}: AdminScreenContext & {
  t: PluginRouteTranslator;
}): Promise<AdminOgImagesRouteData> => {
  requireAdminPermission(adminAccess, {
    module: SEO_MODULE,
    permission: "can_view",
  });

  await queryClient.query({
    ...ogImagesQueryOptions(),
    staleTime: "static",
  });

  return {
    description: t("admin.seo.og_images.desc"),
    title: t("admin.seo.og_images.title"),
  };
};
