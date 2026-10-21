import { useSuspenseQuery } from "@tanstack/react-query";

import { PageTitle } from "@/components/ui/page-title";
import { OgImagesContent } from "@/views/admin/views/core/seo/og-images/og-images-content";
import { ogImageTemplatesQueryOptions } from "@/views/admin/views/core/seo/og-images/og-images-query";

import type { AdminOgImagesRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import { ADMIN_OG_IMAGES_NAMESPACES } from "./route";

export const AdminOgImagesRouteContent = ({
  description,
  title,
}: AdminOgImagesRouteData) => {
  const { data } = useSuspenseQuery(ogImageTemplatesQueryOptions());

  return (
    <RouteMessages namespaces={ADMIN_OG_IMAGES_NAMESPACES}>
      <div className="p-6">
        <PageTitle desc={description} h1={title} />

        <OgImagesContent data={data} />
      </div>
    </RouteMessages>
  );
};
