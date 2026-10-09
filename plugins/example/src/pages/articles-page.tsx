import type { PluginRoutePageProps } from "@vitnode/core/routing";
import type { ContentListSearch } from "@vitnode/core/tanstack/content";

import { DateFormat } from "@vitnode/core/components/date-format";
import { contentDeliveryInternalPath } from "@vitnode/core/content";
import { definePluginRoute } from "@vitnode/core/routing";
import {
  ContentCard,
  ContentList,
  ContentListEmpty,
  ContentListFilter,
  ContentListItem,
  contentListPage,
  contentListPageHead,
  ContentListPagination,
  contentListQuery,
  ContentListSearchForm,
} from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { CONFIG_PLUGIN } from "@/const";
import { articleContentType } from "@/content/article";

const zodArticleCard = z.object({
  excerpt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  slug: z.string(),
  title: z.string(),
});

const loadArticles = async (search: ContentListSearch) => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "content/articles",
    path: "/",
    args: { query: contentListQuery(articleContentType, search) },
  });

  if (response.status !== 200) {
    throw new Error(`Listing articles answered ${response.status}.`);
  }

  const { edges, pageInfo } = await response.json();

  return contentListPage({
    list: { edges: z.array(zodArticleCard).parse(edges), pageInfo },
    search,
  });
};

type ArticlesPageData = Awaited<ReturnType<typeof loadArticles>>;

export const route = definePluginRoute<ArticlesPageData, ContentListSearch>({
  load: async ({ search }) => await loadArticles(search),

  head: ({ search, t }) =>
    contentListPageHead(articleContentType, {
      description: t("@vitnode/example.articles.list.desc"),
      search,
      title: t("@vitnode/example.articles.list.title"),
    }),
});

const ArticlesPage = ({
  loaderData: { edges, pageInfo },
  search,
}: PluginRoutePageProps<ArticlesPageData, ContentListSearch>) => {
  const t = useTranslations("@vitnode/example.articles");

  return (
    <div className="container mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:gap-8 md:py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-foreground text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          {t("list.title")}
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed text-pretty">
          {t("list.desc")}
        </p>
      </header>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <ContentListSearchForm
          className="w-full md:max-w-md"
          label={t("list.search")}
          placeholder={t("list.search")}
          search={search}
        />
        <ContentListFilter
          label={t("list.featured")}
          name="featured"
          options={[
            { label: t("list.featured_only"), value: true },
            { label: t("list.not_featured"), value: false },
          ]}
          search={search}
        />
      </div>

      {edges.length === 0 ? (
        <ContentListEmpty
          description={t("list.empty.desc")}
          title={t("list.empty.title")}
        />
      ) : (
        <ContentList>
          {edges.map(article => (
            <ContentListItem key={article.slug}>
              <ContentCard
                description={article.excerpt}
                href={
                  contentDeliveryInternalPath({
                    definition: articleContentType,
                    slug: article.slug,
                  }) ?? "/articles"
                }
                meta={
                  article.publishedAt ? (
                    <time
                      dateTime={new Date(article.publishedAt).toISOString()}
                    >
                      <DateFormat date={article.publishedAt} showFullDate />
                    </time>
                  ) : null
                }
                title={article.title}
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

export default ArticlesPage;
