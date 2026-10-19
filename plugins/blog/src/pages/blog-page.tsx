import type { QueryClient } from "@tanstack/react-query";
import type { PluginRoutePageProps } from "@vitnode/core/routing";

import { useRouter } from "@tanstack/react-router";
import { Button, buttonVariants } from "@vitnode/core/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@vitnode/core/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@vitnode/core/components/ui/input-group";
import { Label } from "@vitnode/core/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@vitnode/core/components/ui/native-select";
import { Skeleton } from "@vitnode/core/components/ui/skeleton";
import { LOADER_DATA_QUERY_META } from "@vitnode/core/lib/query-client";
import {
  contentListPageHead,
  ContentListPagination,
  ContentListResults,
  useContentListSearchInput,
} from "@vitnode/core/tanstack/content";
import { HrefLink } from "@vitnode/core/tanstack/link";
import { defineRoute } from "@vitnode/core/tanstack/plugin-routes";
import {
  NewspaperIcon,
  RefreshCwIcon,
  SearchIcon,
  SearchXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { BlogListSearch } from "./blog-list";
import type { BlogCategory } from "./blog-queries";

import { BlogPostCard } from "./blog-card";
import { BLOG_HREF, blogPostList } from "./blog-list";
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
  // not an error page; failed categories only cost the labels and the filter.
  const [posts, categories] = await Promise.all([
    queryClient
      .query({
        ...blogPostsQueryOptions({ locale, search }),
        meta: LOADER_DATA_QUERY_META,
      })
      .catch(() => null),
    queryClient
      .query({
        ...blogCategoriesQueryOptions(locale),
        meta: LOADER_DATA_QUERY_META,
      })
      .catch((): BlogCategory[] => []),
  ]);

  return { categories, posts };
};

type BlogPageData = Awaited<ReturnType<typeof loadBlog>>;

const BlogCrumb = () => {
  const t = useTranslations("@vitnode/blog.list");

  return <>{t("title")}</>;
};

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

  breadcrumb: BlogCrumb,
});

const SEARCH_INPUT_ID = "blog-search";
const CATEGORY_SELECT_ID = "blog-category";
const SORT_SELECT_ID = "blog-sort";

const BlogFilters = ({
  categories,
  onChange,
  search,
}: {
  categories: BlogCategory[];
  onChange: (patch: Partial<BlogListSearch>) => void;
  search: BlogListSearch;
}) => {
  const t = useTranslations("@vitnode/blog.list");
  const input = useContentListSearchInput({
    onCommit: q => onChange({ q }),
    value: search.q,
  });

  return (
    <form
      aria-label={t("filters")}
      className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_auto] md:items-end"
      onSubmit={event => {
        event.preventDefault();
        input.commit();
      }}
      role="search"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={SEARCH_INPUT_ID}>{t("search_label")}</Label>
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            autoComplete="off"
            enterKeyHint="search"
            id={SEARCH_INPUT_ID}
            maxLength={256}
            onChange={event => input.setValue(event.target.value)}
            placeholder={t("search_placeholder")}
            type="search"
            value={input.value}
          />
        </InputGroup>
      </div>

      {categories.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={CATEGORY_SELECT_ID}>{t("category_label")}</Label>
          <NativeSelect
            className="w-full md:w-48"
            id={CATEGORY_SELECT_ID}
            onChange={event =>
              onChange({
                category:
                  event.target.value === ""
                    ? undefined
                    : Number(event.target.value),
              })
            }
            value={search.category === undefined ? "" : String(search.category)}
          >
            <NativeSelectOption value="">
              {t("all_categories")}
            </NativeSelectOption>
            {categories.map(category => (
              <NativeSelectOption key={category.id} value={String(category.id)}>
                {category.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor={SORT_SELECT_ID}>{t("sort_label")}</Label>
        <NativeSelect
          className="w-full md:w-44"
          id={SORT_SELECT_ID}
          onChange={event =>
            onChange({
              sort: blogPostList.sorts.find(
                sort => sort === event.target.value,
              ),
            })
          }
          value={search.sort ?? blogPostList.defaultSort}
        >
          {blogPostList.sorts.map(sort => (
            <NativeSelectOption key={sort} value={sort}>
              {t(`sort.${sort}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </form>
  );
};

const BlogGridSkeleton = () => (
  <ul aria-hidden="true" className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: 6 }, (_, index) => (
      <li className="flex flex-col gap-3" key={index}>
        <Skeleton className="aspect-video w-full rounded-xl" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
      </li>
    ))}
  </ul>
);

const BlogEmpty = ({
  action,
  description,
  icon,
  title,
}: {
  action?: React.ReactNode;
  description: string;
  icon: React.ReactNode;
  title: string;
}) => (
  <Empty className="border">
    <EmptyHeader>
      <EmptyMedia variant="icon">{icon}</EmptyMedia>
      <EmptyTitle render={<h2 />}>{title}</EmptyTitle>
      <EmptyDescription>{description}</EmptyDescription>
    </EmptyHeader>
    {action ? <EmptyContent>{action}</EmptyContent> : null}
  </Empty>
);

const BlogPage = ({
  loaderData: { categories, posts },
  navigate,
  search,
}: PluginRoutePageProps<BlogPageData, BlogListSearch>) => {
  const t = useTranslations("@vitnode/blog.list");
  const tGlobal = useTranslations("core.global");
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const isFiltered = blogPostList.isFiltered(search);
  const categoryById = new Map(
    categories.map(category => [category.id, category]),
  );

  const update = (patch: Partial<BlogListSearch>) => {
    startTransition(async () => {
      await navigate({
        resetScroll: false,
        search: blogPostList.withSearch(search, patch),
      });
    });
  };

  const clearFilters = (
    <HrefLink
      className={buttonVariants({ variant: "outline" })}
      href={BLOG_HREF}
    >
      {tGlobal("clear_filters")}
    </HrefLink>
  );

  const range = posts?.pageInfo.currentPage
    ? {
        from: (posts.pageInfo.currentPage - 1) * posts.pageInfo.pageSize + 1,
        to:
          (posts.pageInfo.currentPage - 1) * posts.pageInfo.pageSize +
          posts.pageInfo.count,
        total: posts.pageInfo.totalCount,
      }
    : null;

  return (
    <div className="container mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 md:py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-foreground text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          {t("title")}
        </h1>
        <p className="text-muted-foreground max-w-2xl leading-relaxed text-pretty">
          {t("desc")}
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <BlogFilters
          categories={categories}
          onChange={update}
          search={search}
        />

        <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
          <p
            aria-live="polite"
            className="text-muted-foreground text-sm leading-relaxed tabular-nums"
          >
            {isPending
              ? tGlobal("loading")
              : range && range.total > 0
                ? tGlobal("showing_range", range)
                : null}
          </p>
          {/* With no results the empty state carries its own. */}
          {isFiltered && posts?.edges.length ? clearFilters : null}
        </div>
      </div>

      <ContentListResults
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
        empty={
          <BlogEmpty
            description={t("empty.desc")}
            icon={<NewspaperIcon aria-hidden="true" />}
            title={t("empty.title")}
          />
        }
        error={
          <BlogEmpty
            action={
              <Button
                isLoading={isPending}
                onClick={() => {
                  startTransition(async () => {
                    await router.invalidate();
                  });
                }}
                variant="outline"
              >
                <RefreshCwIcon aria-hidden="true" />
                {t("error.retry")}
              </Button>
            }
            description={t("error.desc")}
            icon={<TriangleAlertIcon aria-hidden="true" />}
            title={t("error.title")}
          />
        }
        getKey={post => post.id}
        isError={posts === null}
        isFetching={isPending}
        isFiltered={isFiltered}
        items={posts?.edges}
        label={t("articles")}
        loading={<BlogGridSkeleton />}
        noResults={
          <BlogEmpty
            action={clearFilters}
            description={t("no_results.desc")}
            icon={<SearchXIcon aria-hidden="true" />}
            title={t("no_results.title")}
          />
        }
        renderItem={(post, index) => (
          <BlogPostCard
            categories={categoryById}
            isPriority={index === 0 && search.page === undefined}
            post={post}
          />
        )}
      />

      {posts ? (
        <ContentListPagination
          hrefFor={page => blogPostList.href(BLOG_HREF, { ...search, page })}
          label={t("pagination")}
          pageInfo={posts.pageInfo}
        />
      ) : null}
    </div>
  );
};

export default BlogPage;
