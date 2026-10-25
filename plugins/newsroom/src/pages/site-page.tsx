import {
  definePluginRoute,
  type PluginRoutePageProps,
} from "@vitnode/core/routing";
import { contentPageItem } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { createBlockRegistry } from "@vitnode/core/widgets";
import { blocks as coreBlocks } from "@vitnode/core/widgets/built-in";
import { ContentZone } from "@vitnode/core/widgets/zone";

import { PAGE_BLOCKS_ALLOWED } from "@/content/page-blocks";
import { manifest } from "@/manifest.gen";
import { widgets } from "@/widgets";

const blocksRegistry = createBlockRegistry([coreBlocks, widgets]);

const loadSitePage = async (slug: string) => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "content/pages",
    path: "/{slug}",
    args: { params: { slug: encodeURIComponent(slug) } },
  });

  return contentPageItem(response.ok ? await response.json() : null);
};

type SitePageData = Awaited<ReturnType<typeof loadSitePage>>;

export const route = definePluginRoute({
  load: async ({ params }) => await loadSitePage(params.slug),

  head: ({ loaderData }) => ({ title: loaderData?.title }),
});

const SitePage = ({ loaderData: page }: PluginRoutePageProps<SitePageData>) => (
  <article className="container mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 md:py-12">
    <h1 className="text-foreground text-3xl font-semibold tracking-tight text-balance md:text-4xl">
      {page.title}
    </h1>

    <ContentZone
      allowedBlocks={PAGE_BLOCKS_ALLOWED}
      blocks={page.content}
      id="content"
      registry={blocksRegistry}
    />
  </article>
);

export default SitePage;
