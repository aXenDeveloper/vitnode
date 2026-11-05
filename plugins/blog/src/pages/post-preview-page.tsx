import type { QueryClient } from "@tanstack/react-query";
import type { PluginRoutePageProps } from "@vitnode/core/routing";

import { notFound } from "@tanstack/react-router";
import { LOADER_DATA_QUERY_META } from "@vitnode/core/lib/query-client";
import { useContentLivePreview } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { defineRoute } from "@vitnode/core/tanstack/plugin-routes";

import { manifest } from "@/manifest.gen";

import type { BlogCategories } from "./blog-queries";
import type { BlogPostPreviewSearch } from "./post-preview";

import { blogCategoriesQueryOptions } from "./blog-queries";
import { BlogArticle } from "./post-article";
import { applyBlogLivePreview } from "./post-preview";

const loadBlogPostPreview = async (
  queryClient: QueryClient,
  { locale, token }: { locale: string; token: string },
) => {
  const [response, categories] = await Promise.all([
    fetcher({
      plugin: manifest.id,
      method: "get",
      module: "content/blog",
      path: "/preview/{token}",
      args: {
        params: { token: encodeURIComponent(token) },
        query: { locale },
      },
    }),
    queryClient
      .query({
        ...blogCategoriesQueryOptions(locale),
        meta: LOADER_DATA_QUERY_META,
      })
      .catch((): BlogCategories => ({ items: [], total: 0 })),
  ]);

  // oxlint-disable-next-line typescript/only-throw-error
  if (response.status !== 200) throw notFound();

  return {
    categories: categories.items,
    item: await response.json(),
    locale,
  };
};

type BlogPostPreviewData = Awaited<ReturnType<typeof loadBlogPostPreview>>;

export const route = defineRoute<BlogPostPreviewData, BlogPostPreviewSearch>({
  load: async ({ context, params, search }) =>
    await loadBlogPostPreview(context.queryClient, {
      locale: search.locale ?? context.locale,
      token: params.token,
    }),

  head: ({ loaderData, t }) => ({
    robots: "noindex, nofollow",
    title: t("@vitnode/blog.post.preview.title", {
      title: loaderData?.item.title ?? "",
    }),
  }),
});

const BlogPostPreviewPage = ({
  loaderData: { categories, item, locale },
}: PluginRoutePageProps<BlogPostPreviewData, BlogPostPreviewSearch>) => {
  const live = useContentLivePreview();

  return (
    <BlogArticle
      categories={categories}
      hidden={false}
      item={applyBlogLivePreview(item, live)}
      locale={live?.locale ?? locale}
    />
  );
};

export default BlogPostPreviewPage;
