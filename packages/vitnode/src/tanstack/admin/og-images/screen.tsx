import { useSuspenseQuery } from "@tanstack/react-query";

import { PageTitle } from "@/components/ui/page-title";
import { OgImagesContent } from "@/views/admin/views/core/seo/og-images/og-images-content";
import {
  ogImagesQueryOptions,
  renderOgImagePreview,
} from "@/views/admin/views/core/seo/og-images/og-images-query";

import type { AdminOgImagesRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import { ADMIN_OG_IMAGES_NAMESPACES } from "./route";

export const AdminOgImagesRouteContent = ({
  description,
  title,
}: AdminOgImagesRouteData) => {
  const { data } = useSuspenseQuery(ogImagesQueryOptions());

  return (
    <RouteMessages namespaces={ADMIN_OG_IMAGES_NAMESPACES}>
      <div className="flex flex-col gap-6 p-6">
        <PageTitle desc={description} h1={title} />

        <OgImagesContent data={data} onRender={renderOgImagePreview} />
      </div>
    </RouteMessages>
  );
};
