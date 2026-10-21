import type { QueryClient } from "@tanstack/react-query";
import type { PluginRoutePageProps } from "@vitnode/core/routing";

import { redirect } from "@tanstack/react-router";
import { LOADER_DATA_QUERY_META } from "@vitnode/core/lib/query-client";
import { contentListPageHead } from "@vitnode/core/tanstack/content";
import { localizeHref } from "@vitnode/core/tanstack/i18n";
import { defineRoute } from "@vitnode/core/tanstack/plugin-routes";

import type { BlogListSearch } from "./blog-list";
import type { BlogCategories } from "./blog-queries";

import { BlogIndex } from "./blog-index";
import { BLOG_HREF, blogCategoryHref, blogPostList } from "./blog-list";
import {
  blogCategoriesQueryOptions,
  blogPostsQueryOptions,
} from "./blog-queries";

const loadBlog = async (
  queryClient: QueryClient,
  { locale, search }: { locale: string; search: BlogListSearch },
) => {
  // The loader's own data carries both to the browser, so neither query is
  // dehydrated a second time. A failed list is an error state on the page,
  // not an error page; failed categories only cost the labels and the sidebar.
  const [posts, categories] = await Promise.all([
    queryClient
      .query({
        ...blogPostsQueryOptions({ locale, search: { page: search.page } }),
        meta: LOADER_DATA_QUERY_META,
      })
      .catch(() => null),
    queryClient
      .query({
        ...blogCategoriesQueryOptions(locale),
        meta: LOADER_DATA_QUERY_META,
      })
      .catch((): BlogCategories => ({ items: [], total: 0 })),
  ]);

  const legacyCategory = categories.items.find(
    category => category.id === search.category,
  );
  if (legacyCategory) {
    // oxlint-disable-next-line typescript/only-throw-error
    throw redirect({
      href: localizeHref(blogCategoryHref(legacyCategory.slug), locale),
      statusCode: 308,
    });
  }

  return { categories, posts };
};

type BlogPageData = Awaited<ReturnType<typeof loadBlog>>;

export const route = defineRoute<BlogPageData, BlogListSearch>({
  load: async ({ context, search }) =>
    await loadBlog(context.queryClient, { locale: context.locale, search }),

  head: ({ loaderData, search, t }) => {
    // The page the API actually served: past the last one it answers the last.
    const page = loaderData?.posts?.pageInfo.currentPage ?? search.page ?? 1;

    return contentListPageHead({
      description: t("@vitnode/blog.list.desc"),
      pathname: BLOG_HREF,
      search,
      title:
        page > 1
          ? t("@vitnode/blog.list.title_page", { page })
          : t("@vitnode/blog.list.title"),
    });
  },
});

const BlogPage = ({
  loaderData: { categories, posts },
  search,
}: PluginRoutePageProps<BlogPageData, BlogListSearch>) => (
  <BlogIndex
    categories={categories}
    hrefFor={page => blogPostList.href(BLOG_HREF, { page })}
    page={search.page ?? 1}
    posts={posts}
    search={{ page: search.page }}
  />
);

export default BlogPage;
