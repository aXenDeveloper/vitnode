import type { QueryClient } from "@tanstack/react-query";
import type { PluginRoutePageProps } from "@vitnode/core/routing";

import { notFound, redirect } from "@tanstack/react-router";
import { LOADER_DATA_QUERY_META } from "@vitnode/core/lib/query-client";
import { contentListPageHead } from "@vitnode/core/tanstack/content";
import { localizeHref } from "@vitnode/core/tanstack/i18n";
import { defineRoute } from "@vitnode/core/tanstack/plugin-routes";

import type { BlogCategoryListSearch } from "./blog-list";

import { BlogIndex } from "./blog-index";
import { blogCategoryHref, blogCategoryPostList } from "./blog-list";
import {
  blogCategoriesQueryOptions,
  blogPostsQueryOptions,
} from "./blog-queries";

const loadBlogCategory = async (
  queryClient: QueryClient,
  {
    locale,
    search,
    slug,
  }: { locale: string; search: BlogCategoryListSearch; slug: string },
) => {
  const categories = await queryClient.query({
    ...blogCategoriesQueryOptions(locale),
    meta: LOADER_DATA_QUERY_META,
  });
  const selected = categories.items.find(category => category.slug === slug);

  if (!selected) {
    const translated = categories.items.find(category =>
      Object.values(category.slugs).includes(slug),
    );
    if (!translated) {
      // oxlint-disable-next-line typescript/only-throw-error
      throw notFound();
    }

    // oxlint-disable-next-line typescript/only-throw-error
    throw redirect({
      href: localizeHref(blogCategoryHref(translated.slug), locale),
      statusCode: 308,
    });
  }

  const posts = await queryClient
    .query({
      ...blogPostsQueryOptions({
        locale,
        search: { category: selected.id, page: search.page },
      }),
      meta: LOADER_DATA_QUERY_META,
    })
    .catch(() => null);

  return { categories, posts, selected };
};

type BlogCategoryPageData = Awaited<ReturnType<typeof loadBlogCategory>>;

export const route = defineRoute<BlogCategoryPageData, BlogCategoryListSearch>({
  load: async ({ context, params, search }) =>
    await loadBlogCategory(context.queryClient, {
      locale: context.locale,
      search,
      slug: params.slug,
    }),

  head: ({ loaderData, search, t }) => {
    if (!loaderData) return {};

    const { posts, selected } = loaderData;
    const page = posts?.pageInfo.currentPage ?? search.page ?? 1;
    const head = contentListPageHead({
      description: t("@vitnode/blog.list.category_desc", {
        name: selected.name,
      }),
      pathname: blogCategoryHref(selected.slug),
      search,
      title:
        page > 1
          ? t("@vitnode/blog.list.category_title_page", {
              name: selected.name,
              page,
            })
          : t("@vitnode/blog.list.category_title", { name: selected.name }),
    });

    if (head.alternates) {
      head.alternates = Object.fromEntries(
        Object.entries(selected.slugs).map(([locale, slug]) => [
          locale,
          blogCategoryHref(slug),
        ]),
      );
    }

    return head;
  },
});

const BlogCategoryPage = ({
  loaderData: { categories, posts, selected },
  search,
}: PluginRoutePageProps<BlogCategoryPageData, BlogCategoryListSearch>) => (
  <BlogIndex
    categories={categories}
    hrefFor={page =>
      blogCategoryPostList.href(blogCategoryHref(selected.slug), { page })
    }
    page={search.page ?? 1}
    posts={posts}
    search={{ category: selected.id, page: search.page }}
    selected={selected}
  />
);

export default BlogCategoryPage;
