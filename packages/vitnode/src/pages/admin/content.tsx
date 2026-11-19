import { notFound } from "@tanstack/react-router";

import type { ContentFrontendRegistry } from "@/content/admin/registry";
import type { PluginRoutePageProps } from "@/routing";
import type { ContentListRouteSearch } from "@/tanstack/admin/content/route-search";
import type { AdminRouteLoadContext } from "@/tanstack/plugin-routes";

import { ContentContainerBreadcrumbContent } from "@/tanstack/admin/containers/breadcrumb";
import { loadContentContainerRoute } from "@/tanstack/admin/containers/route";
import { ContentContainerScreenContent } from "@/tanstack/admin/containers/screen";
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

const loadContentTypePage = async ({
  context,
  search,
  segments,
}: {
  context: AdminRouteLoadContext;
  search: ContentListRouteSearch;
  segments: string[];
}) => {
  const resolved = await loadContentAdminRoute({
    ...context,
    registry,
    search,
    segments,
  });

  return {
    ...resolved,
    ...(await loadContentFormScreen({ ...context, registry, route: resolved })),
  };
};

const loadContentPage = async ({
  context,
  params,
  search,
}: {
  context: AdminRouteLoadContext;
  params: Readonly<Record<string, string>>;
  search: ContentListRouteSearch;
}) => {
  const segments = [params.section, ...contentRouteSegments(params._splat)];

  if (registry.containers.byAdminPath(segments.join("/"))) {
    return {
      kind: "container" as const,
      ...(await loadContentContainerRoute({ ...context, registry, segments })),
    };
  }

  return {
    kind: "content" as const,
    ...(await loadContentTypePage({ context, search, segments })),
  };
};

const ContentAdminPage = ({
  loaderData,
  navigate,
  search,
}: PluginRoutePageProps<ContentPageData, ContentListRouteSearch>) => {
  if (loaderData.kind === "content") {
    return (
      <ContentAdminScreenContent
        {...loaderData}
        navigate={navigate}
        registry={registry}
        search={search}
      />
    );
  }

  const entry = registry.containers.byId(loaderData.definitionId);

  if (!entry) {
    // oxlint-disable-next-line typescript/only-throw-error
    throw notFound();
  }

  return <ContentContainerScreenContent {...loaderData} entry={entry} />;
};

export const route = defineAdminRoute<ContentPageData, ContentListRouteSearch>({
  // `head` after `load`, always.
  load: async ({ context, params, search }) =>
    await loadContentPage({ context, params, search }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: routeBreadcrumbGroup<ContentPageData>(
    function ContentAdminBreadcrumb({ loaderData }) {
      if (loaderData?.kind === "container") {
        return <ContentContainerBreadcrumbContent {...loaderData} />;
      }

      return <ContentAdminBreadcrumbContent {...loaderData} />;
    },
  ),
});

export default ContentAdminPage;
