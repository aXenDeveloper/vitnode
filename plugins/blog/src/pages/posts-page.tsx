import type { PluginRoutePageProps } from "@vitnode/core/routing";
import type { ContentListSearch } from "@vitnode/core/tanstack/content";

import { DateFormat } from "@vitnode/core/components/date-format";
import {
  contentDeliveryInternalPath,
  zodContentFileDescriptor,
} from "@vitnode/core/content";
import { resolveImageAlt } from "@vitnode/core/lib/files/resolve-alt";
import { definePluginRoute } from "@vitnode/core/routing";
import {
  ContentCard,
  ContentList,
  ContentListEmpty,
  ContentListItem,
  contentListPage,
  contentListPageHead,
  ContentListPagination,
  contentListQuery,
  ContentListSearchForm,
} from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { getIntlRuntime } from "@vitnode/core/tanstack/i18n";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { CONFIG_PLUGIN } from "@/const";
import { blogPostContentType } from "@/content/post";

const zodBlogPostCard = z.object({
  coverImage: zodContentFileDescriptor.nullable(),
  coverImageAlt: z.string().nullable(),
  excerpt: z.string().nullable(),
  friendlyUrl: z.string(),
  id: z.number(),
  locale: z.string().nullable().optional(),
  publishedAt: z.string().nullable(),
  title: z.string(),
});

const loadPosts = async ({
  locale,
  search,
}: {
  locale: string;
  search: ContentListSearch;
}) => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "content/blog",
    path: "/",
    args: {
      query: { ...contentListQuery(blogPostContentType, search), locale },
    },
  });

  if (response.status !== 200) {
    throw new Error(`Listing blog articles answered ${response.status}.`);
  }

  const { edges, pageInfo } = await response.json();

  return contentListPage({
    list: { edges: z.array(zodBlogPostCard).parse(edges), pageInfo },
    search,
  });
};

type BlogPostsPageData = Awaited<ReturnType<typeof loadPosts>>;

export const route = definePluginRoute<BlogPostsPageData, ContentListSearch>({
  load: async ({ context, search }) =>
    await loadPosts({ locale: context.locale, search }),

  head: ({ search, t }) =>
    contentListPageHead(blogPostContentType, {
      description: t("@vitnode/blog.list.desc"),
      search,
      title: t("@vitnode/blog.list.title"),
    }),
});

const BlogPostsPage = ({
  loaderData: { edges, pageInfo },
  search,
}: PluginRoutePageProps<BlogPostsPageData, ContentListSearch>) => {
  const t = useTranslations("@vitnode/blog.list");
  const { defaultLocale } = getIntlRuntime();
  const empty = search.q === undefined ? "empty" : "no_results";

  return (
    <div className="container mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:gap-8 md:py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-foreground text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          {t("title")}
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed text-pretty">
          {t("desc")}
        </p>
      </header>

      <ContentListSearchForm
        className="max-w-xl"
        label={t("search")}
        placeholder={t("search")}
        search={search}
      />

      {edges.length === 0 ? (
        <ContentListEmpty
          description={t(`${empty}.desc`)}
          title={t(`${empty}.title`)}
        />
      ) : (
        <ContentList>
          {edges.map(post => (
            <ContentListItem key={post.id}>
              <ContentCard
                description={post.excerpt}
                href={
                  contentDeliveryInternalPath({
                    definition: blogPostContentType,
                    slug: post.friendlyUrl,
                  }) ?? "/blog"
                }
                image={
                  post.coverImage
                    ? {
                        alt: resolveImageAlt({
                          alts: post.coverImage.alts,
                          fallbackLocales: [defaultLocale],
                          locale: post.locale ?? defaultLocale,
                          occurrence: { alt: post.coverImageAlt },
                        }).alt,
                        height: post.coverImage.height,
                        src: post.coverImage.url,
                        width: post.coverImage.width,
                      }
                    : null
                }
                meta={
                  post.publishedAt ? (
                    <time dateTime={new Date(post.publishedAt).toISOString()}>
                      <DateFormat date={post.publishedAt} showFullDate />
                    </time>
                  ) : null
                }
                title={post.title}
              />
            </ContentListItem>
          ))}
        </ContentList>
      )}

      <ContentListPagination
        page={pageInfo.currentPage ?? 1}
        search={search}
        totalPages={pageInfo.totalPages}
      />
    </div>
  );
};

export default BlogPostsPage;
