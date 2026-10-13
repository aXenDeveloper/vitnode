import { notFound } from "@tanstack/react-router";

import type { ContentFrontendRegistry } from "@/content/admin/registry";
import type { PluginRoutePageProps } from "@/routing";
import type { ContentContainerRouteData } from "@/tanstack/admin/containers/route";

import { ContentContainerBreadcrumbContent } from "@/tanstack/admin/containers/breadcrumb";
import { loadContentContainerRoute } from "@/tanstack/admin/containers/route";
import { ContentContainerScreenContent } from "@/tanstack/admin/containers/screen";
import { getContentRegistryLoader } from "@/tanstack/admin/content/registry-runtime";
import { contentRouteSegments } from "@/tanstack/admin/content/route";
import {
  defineAdminRoute,
  routeBreadcrumbGroup,
} from "@/tanstack/plugin-routes";

const registry: ContentFrontendRegistry = await getContentRegistryLoader()();

const ContentContainerPage = ({
  loaderData,
}: PluginRoutePageProps<ContentContainerRouteData>) => {
  const entry = registry.containers.byId(loaderData.definitionId);

  if (!entry) {
    // oxlint-disable-next-line typescript/only-throw-error
    throw notFound();
  }

  return <ContentContainerScreenContent {...loaderData} entry={entry} />;
};

export const route = defineAdminRoute<ContentContainerRouteData>({
  load: async ({ context, params }) =>
    await loadContentContainerRoute({
      ...context,
      registry,
      segments: contentRouteSegments(params._splat),
    }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: routeBreadcrumbGroup<ContentContainerRouteData>(
    function ContentContainerBreadcrumb({ loaderData }) {
      return <ContentContainerBreadcrumbContent {...loaderData} />;
    },
  ),
});

export default ContentContainerPage;
