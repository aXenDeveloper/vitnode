import {
  definePluginRoute,
  type PluginRoutePageProps,
} from "@vitnode/core/routing";
import {
  contentDeliveryPage,
  contentDeliveryPageHead,
} from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { z } from "zod";

import { CONFIG_PLUGIN } from "@/const";

import { ContentArticle } from "./content-article";

const zodArticle = z.object({
  excerpt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  title: z.string(),
});

const loadArticle = async (slug: string) => {
  const [resolution, detail] = await Promise.all([
    fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      method: "get",
      module: "content/articles",
      path: "/delivery/resolve/{slug}",
      args: { params: { slug: encodeURIComponent(slug) } },
    }),
    fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      method: "get",
      module: "content/articles",
      path: "/{slug}",
      args: { params: { slug: encodeURIComponent(slug) } },
    }),
  ]);

  if (resolution.status !== 200) {
    throw new Error(
      `Resolving the article "${slug}" answered ${resolution.status}.`,
    );
  }

  return contentDeliveryPage({
    item: detail.status === 200 ? zodArticle.parse(await detail.json()) : null,
    resolution: await resolution.json(),
  });
};

type ArticlePageData = Awaited<ReturnType<typeof loadArticle>>;

export const route = definePluginRoute({
  load: async ({ params }) => await loadArticle(params.slug),

  head: ({ loaderData }) =>
    contentDeliveryPageHead(loaderData?.metadata, {
      title: loaderData?.item.title,
    }),
});

const ArticlePage = ({
  loaderData: { item },
}: PluginRoutePageProps<ArticlePageData>) => (
  <ContentArticle
    lead={item.excerpt}
    publishedAt={item.publishedAt}
    title={item.title}
  />
);

export default ArticlePage;
