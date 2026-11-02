import { useQuery } from "@tanstack/react-query";
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
import { useSessionQuery } from "@vitnode/core/tanstack/auth";
import {
  ContentAccessRequired,
  ContentListPagination,
} from "@vitnode/core/tanstack/content";
import { HrefLink } from "@vitnode/core/tanstack/link";
import {
  FolderOpenIcon,
  NewspaperIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from "lucide-react";
import React from "react";
import { useLocale, useTranslations } from "use-intl";

import type { BlogListSearch } from "./blog-list";
import type {
  BlogCategories,
  BlogCategory,
  BlogPostCardData,
  BlogPostPage,
} from "./blog-queries";

import { BlogCategorySwatch, BlogPostCard, BlogPostTile } from "./blog-card";
import { BlogCategoryChips, BlogCategorySidebar } from "./blog-categories";
import { BLOG_HREF, blogCategoryHref } from "./blog-list";
import {
  blogViewerCategoriesQueryOptions,
  blogViewerPostsQueryOptions,
} from "./blog-queries";
import { BlogTransitionStyles } from "./blog-transitions";

const TOP_STORIES = 6;

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

const TopStories = ({
  categories,
  posts,
}: {
  categories: ReadonlyMap<number, BlogCategory>;
  posts: BlogPostCardData[];
}) => {
  const t = useTranslations("@vitnode/blog.list");
  const [lead, ...rest] = posts;

  return (
    <section aria-labelledby="blog-top-stories" className="flex flex-col gap-4">
      <h2 className="sr-only" id="blog-top-stories">
        {t("top_stories")}
      </h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:grid-rows-2">
        <BlogPostTile
          categories={categories}
          className="lg:col-span-2 lg:row-span-2 lg:aspect-auto"
          isLead
          post={lead}
        />
        {rest.slice(0, 2).map(post => (
          <BlogPostTile categories={categories} key={post.id} post={post} />
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {rest.slice(2).map(post => (
          <li key={post.id}>
            <BlogPostTile categories={categories} post={post} />
          </li>
        ))}
      </ul>
    </section>
  );
};

const useSharedRenderViewerId = (): null | number => {
  const session = useSessionQuery();
  const [isSharedRender] = React.useState(session.isPending);

  return isSharedRender ? (session.data?.user?.id ?? null) : null;
};

export const BlogIndex = ({
  categories: renderedCategories,
  hrefFor,
  page,
  posts: renderedPosts,
  search,
  selected: renderedSelected,
}: {
  categories: BlogCategories;
  hrefFor: (page: number) => string;
  page: number;
  posts: BlogPostPage | null;
  search: BlogListSearch;
  selected?: BlogCategory;
}) => {
  const t = useTranslations("@vitnode/blog.list");
  const locale = useLocale();
  const viewerId = useSharedRenderViewerId();
  const isViewerRead = viewerId !== null;
  const { data: viewerPosts } = useQuery({
    ...blogViewerPostsQueryOptions({
      locale,
      search,
      viewerId: viewerId ?? 0,
    }),
    enabled: isViewerRead,
  });
  const { data: viewerCategories } = useQuery({
    ...blogViewerCategoriesQueryOptions({ locale, viewerId: viewerId ?? 0 }),
    enabled: isViewerRead,
  });
  const posts = isViewerRead ? (viewerPosts ?? renderedPosts) : renderedPosts;
  const categories = isViewerRead
    ? (viewerCategories ?? renderedCategories)
    : renderedCategories;
  const selected = renderedSelected
    ? (categories.items.find(category => category.id === renderedSelected.id) ??
      renderedSelected)
    : undefined;
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const categoryById = new Map(
    categories.items.map(category => [category.id, category]),
  );
  const edges = posts?.edges ?? [];
  const hasTop = !selected && page === 1 && edges.length >= TOP_STORIES;
  const list = hasTop ? edges.slice(TOP_STORIES) : edges;
  const nav = {
    categories: categories.items,
    categoryHref: (category: BlogCategory | undefined) =>
      category ? blogCategoryHref(category.slug) : BLOG_HREF,
    selected: selected?.id,
    total: categories.total,
  };

  const body = () => {
    // A category the viewer may see but not read lists nothing at all.
    if (selected && !selected.access.canRead) {
      return <ContentAccessRequired headingLevel="h3" />;
    }

    if (!posts) {
      return (
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
      );
    }

    if (edges.length === 0) {
      return selected ? (
        <BlogEmpty
          action={
            <HrefLink
              className={buttonVariants({ variant: "outline" })}
              href={BLOG_HREF}
            >
              {t("no_results.action")}
            </HrefLink>
          }
          description={t("no_results.desc")}
          icon={<FolderOpenIcon aria-hidden="true" />}
          title={t("no_results.title")}
        />
      ) : (
        <BlogEmpty
          description={t("empty.desc")}
          icon={<NewspaperIcon aria-hidden="true" />}
          title={t("empty.title")}
        />
      );
    }

    return (
      <>
        {list.length > 0 ? (
          <ul aria-label={t("articles")} className="flex flex-col gap-5">
            {list.map(post => (
              <li key={post.id}>
                <BlogPostCard categories={categoryById} post={post} />
              </li>
            ))}
          </ul>
        ) : null}
        <ContentListPagination
          hrefFor={hrefFor}
          label={t("pagination")}
          pageInfo={posts.pageInfo}
        />
      </>
    );
  };

  return (
    <div className="container mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 md:py-12">
      <BlogTransitionStyles />
      <header className="flex flex-col gap-3">
        <h1 className="text-foreground flex items-center gap-3 text-3xl font-semibold tracking-tight text-balance md:gap-4 md:text-5xl">
          {selected ? (
            <BlogCategorySwatch
              category={selected}
              className="size-6 rounded-md md:size-9 md:rounded-lg"
            />
          ) : null}
          {selected?.name ?? t("title")}
        </h1>
        <p className="text-muted-foreground max-w-2xl text-base leading-relaxed text-pretty md:text-lg">
          {selected
            ? selected.access.canRead
              ? t("article_count", { count: selected.articleCount })
              : null
            : t("desc")}
        </p>
      </header>

      {hasTop ? (
        <TopStories
          categories={categoryById}
          posts={edges.slice(0, TOP_STORIES)}
        />
      ) : null}

      {categories.items.length > 0 ? (
        <div className="lg:hidden">
          <BlogCategoryChips {...nav} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_17rem]">
        <section
          aria-labelledby="blog-list-heading"
          className="flex min-w-0 flex-col gap-4"
        >
          <h2
            className="text-foreground text-xl font-semibold tracking-tight"
            id="blog-list-heading"
          >
            {hasTop
              ? t("more_articles")
              : selected
                ? t("articles")
                : t("all_articles")}
          </h2>
          {body()}
        </section>
        {categories.items.length > 0 ? (
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <BlogCategorySidebar {...nav} />
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
};
