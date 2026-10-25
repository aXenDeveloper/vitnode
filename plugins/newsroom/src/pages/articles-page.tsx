import type { PluginRoutePageProps } from "@vitnode/core/routing";

import { DateFormat } from "@vitnode/core/components/date-format";
import { Input } from "@vitnode/core/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@vitnode/core/components/ui/native-select";
import { LOADER_DATA_QUERY_META } from "@vitnode/core/lib/query-client";
import {
  contentListPageHead,
  ContentListPagination,
  ContentListResults,
  useContentListSearchInput,
} from "@vitnode/core/tanstack/content";
import { HrefLink } from "@vitnode/core/tanstack/link";
import {
  defineRoute,
  type RouteLoadContext,
} from "@vitnode/core/tanstack/plugin-routes";
import { useTransition } from "react";
import { useTranslations } from "use-intl";

import type { ArticleListSearch } from "./article-list";

import { articleList, articlesQueryOptions } from "./article-list";

const loadArticles = async (
  { locale, queryClient }: RouteLoadContext,
  search: ArticleListSearch,
) =>
  // A failed list becomes a message on the page, not an error page.
  await queryClient
    .query({
      ...articlesQueryOptions({ locale, search }),
      meta: LOADER_DATA_QUERY_META,
    })
    .catch(() => null);

type ArticlesPageData = Awaited<ReturnType<typeof loadArticles>>;

export const route = defineRoute<ArticlesPageData, ArticleListSearch>({
  load: async ({ context, search }) => await loadArticles(context, search),

  head: ({ search, t }) =>
    contentListPageHead({
      description: t("newsroom.articles.desc"),
      pathname: "/news",
      search,
      title: t("newsroom.articles.title"),
    }),
});

const ArticlesPage = ({
  loaderData: articles,
  navigate,
  search,
}: PluginRoutePageProps<ArticlesPageData, ArticleListSearch>) => {
  const t = useTranslations("newsroom.articles");
  const [isPending, startTransition] = useTransition();
  const update = (patch: Partial<ArticleListSearch>) => {
    startTransition(async () => {
      await navigate({
        resetScroll: false,
        search: articleList.withSearch(search, patch),
      });
    });
  };
  const input = useContentListSearchInput({
    onCommit: q => {
      update({ q });
    },
    value: search.q,
  });

  return (
    <div className="container mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight text-balance">
        {t("title")}
      </h1>

      <div
        className="flex flex-col gap-3 md:flex-row md:items-center"
        role="search"
      >
        <Input
          aria-label={t("search_label")}
          className="md:flex-1"
          onChange={event => {
            input.setValue(event.target.value);
          }}
          onKeyDown={event => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              input.commit();
            }
          }}
          placeholder={t("search_label")}
          type="search"
          value={input.value}
        />
        <NativeSelect
          aria-label={t("sort_label")}
          onChange={event => {
            update({
              sort: articleList.sorts.find(sort => sort === event.target.value),
            });
          }}
          value={search.sort ?? articleList.defaultSort}
        >
          {articleList.sorts.map(sort => (
            <NativeSelectOption key={sort} value={sort}>
              {t(`sort.${sort}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <ContentListResults
        className="flex flex-col divide-y rounded-lg border"
        empty={<p className="text-muted-foreground">{t("empty")}</p>}
        error={<p className="text-destructive">{t("error")}</p>}
        getKey={article => article.id}
        isError={articles === null}
        isFetching={isPending}
        isFiltered={articleList.isFiltered(search)}
        itemClassName="flex flex-col gap-1 p-4"
        items={articles?.edges}
        label={t("title")}
        loading={null}
        noResults={<p className="text-muted-foreground">{t("no_results")}</p>}
        renderItem={article => (
          <>
            <HrefLink
              className="text-lg font-medium hover:underline"
              href={`/news/${article.slug}`}
            >
              {article.title}
            </HrefLink>
            {article.publishedAt ? (
              <span className="text-muted-foreground text-sm">
                <DateFormat date={article.publishedAt} />
              </span>
            ) : null}
          </>
        )}
      />

      {articles ? (
        <ContentListPagination
          hrefFor={page => articleList.href("/news", { ...search, page })}
          label={t("pagination")}
          pageInfo={articles.pageInfo}
        />
      ) : null}
    </div>
  );
};

export default ArticlesPage;
