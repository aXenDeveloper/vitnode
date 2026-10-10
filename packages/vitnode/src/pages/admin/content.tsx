import type { ContentFrontendRegistry } from "@/content/admin/registry";
import type { PluginRoutePageProps } from "@/routing";
import type { ContentListRouteSearch } from "@/tanstack/admin/content/route-search";
import type { AdminRouteLoadContext } from "@/tanstack/plugin-routes";

import { ContentAdminBreadcrumbContent } from "@/tanstack/admin/content/breadcrumb";
import { loadContentFormScreen } from "@/tanstack/admin/content/form/route";
import { getContentRegistryLoader } from "@/tanstack/admin/content/registry-runtime";
import {
  contentRouteSegments,
  loadContentAdminRoute,
} from "@/tanstack/admin/content/route";
import { ContentAdminScreenContent } from "@/tanstack/admin/content/screen";
import {
  defineAdminRoute,
  routeBreadcrumbGroup,
} from "@/tanstack/plugin-routes";

/**
 * The registry, resolved once per module load and shared by the loader and the
 * component.
 *
 * Deliberately *not* loader data: it carries every content type's editor fields
 * and form layouts, so returning it would serialise the whole thing into the
 * SSR payload.
 */
const registry: ContentFrontendRegistry = await getContentRegistryLoader()();

type ContentPageData = Awaited<ReturnType<typeof loadContentPage>>;

const loadContentPage = async ({
  context,
  params,
  search,
}: {
  context: AdminRouteLoadContext;
  params: Readonly<Record<string, string>>;
  search: ContentListRouteSearch;
}) => {
  const resolved = await loadContentAdminRoute({
    ...context,
    registry,
    search,
    segments: contentRouteSegments(params._splat),
  });

  return {
    ...resolved,
    ...(await loadContentFormScreen({ ...context, registry, route: resolved })),
  };
};

const ContentAdminPage = ({
  loaderData,
  navigate,
  search,
}: PluginRoutePageProps<ContentPageData, ContentListRouteSearch>) => (
  <ContentAdminScreenContent
    {...loaderData}
    navigate={navigate}
    registry={registry}
    search={search}
  />
);

export const route = defineAdminRoute<ContentPageData, ContentListRouteSearch>({
  // `head` after `load`, always.
  load: async ({ context, params, search }) =>
    await loadContentPage({ context, params, search }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: routeBreadcrumbGroup<ContentPageData>(
    function ContentAdminBreadcrumb({ loaderData }) {
      return <ContentAdminBreadcrumbContent {...loaderData} />;
    },
  ),
});

export default ContentAdminPage;
