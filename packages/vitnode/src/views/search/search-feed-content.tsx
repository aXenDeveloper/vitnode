"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import React from "react";
import { useTranslations } from "use-intl";

import type { searchModule } from "@/api/modules/search/search.module";

import { Avatar } from "@/components/avatar";
import { DateFormat } from "@/components/date-format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { CONFIG_PLUGIN } from "@/config";
import { clientModule, fetcherClient } from "@/lib/fetcher-client";
import { cn } from "@/lib/utils";

import type { SearchFeedPage, SearchResultItem } from "./types";

import { getSearchTypeRenderer } from "./registry";

const searchRef = clientModule<typeof searchModule>(CONFIG_PLUGIN.pluginId);
const SNIPPET_LENGTH = 240;

export type SearchFeedVariant = "list" | "timeline";

export interface SearchFeedParams {
  authorId?: string;
  from?: string;
  search?: string;
  sort?: "newest" | "oldest" | "relevance";
  to?: string;
  types?: string;
}

/**
 * Everything the feed ever asks a link to be.
 *
 * Deliberately three props and no more. A search hit is a title and a
 * destination - it never needs prefetch hints, scroll behaviour or an active
 * state - so widening this later is a decision somebody has to make on purpose
 * rather than one that leaks in.
 */
export interface SearchFeedLinkProps {
  children: React.ReactNode;
  className?: string;
  href: string;
}

/**
 * The one thing this feed cannot decide for itself.
 *
 * A search result carries an app-internal path, and turning a path into a
 * client-side navigation is the single question whose answer differs between
 * the two frameworks: Next.js wants `next-intl`'s locale-aware `Link`, TanStack
 * Start wants the router's own. Both are a component taking
 * {@link SearchFeedLinkProps}, so the feed takes one and stops caring.
 *
 * It is a required prop rather than one defaulting to `<a>`: a missing wrapper
 * would otherwise degrade silently into a full document reload, which is the
 * kind of regression nobody notices until someone measures it.
 */
export type SearchFeedLinkComponent = (
  props: SearchFeedLinkProps,
) => React.ReactNode;

const getSnippet = (content: string): string =>
  content.length > SNIPPET_LENGTH
    ? `${content.slice(0, SNIPPET_LENGTH).trimEnd()}…`
    : content;

/**
 * Anything a router cannot own: `https:`, `mailto:`, `tel:`, `//host/path`.
 *
 * Checked here rather than in each wrapper because it is a property of the
 * indexed data, not of the framework - a plugin is free to index an off-site
 * URL, and neither `next-intl`'s `Link` nor TanStack's would accept one. Both
 * frameworks therefore only ever see an internal path, and an external hit
 * renders the same bare `<a>` it renders today.
 */
const isExternalHref = (href: string): boolean =>
  href.startsWith("//") || /^[a-z][a-z\d+\-.]*:/i.test(href);

const ResultLink = ({
  LinkComponent,
  children,
  className,
  href,
}: SearchFeedLinkProps & { LinkComponent: SearchFeedLinkComponent }) =>
  isExternalHref(href) ? (
    <a className={className} href={href}>
      {children}
    </a>
  ) : (
    <LinkComponent className={className} href={href}>
      {children}
    </LinkComponent>
  );

const ItemTitle = ({
  LinkComponent,
  item,
}: {
  item: SearchResultItem;
  LinkComponent: SearchFeedLinkComponent;
}) =>
  item.url ? (
    <ResultLink
      className="hover:underline"
      href={item.url}
      LinkComponent={LinkComponent}
    >
      {item.title}
    </ResultLink>
  ) : (
    <>{item.title}</>
  );

const TimelineItem = ({
  LinkComponent,
  item,
  isLast,
}: {
  isLast: boolean;
  item: SearchResultItem;
  LinkComponent: SearchFeedLinkComponent;
}) => {
  const t = useTranslations("core.search");
  const renderer = getSearchTypeRenderer(item.itemType);
  const Icon = renderer.icon;
  const snippet = getSnippet(item.content);

  const content = (
    <>
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        {item.author && (
          <>
            <Avatar size={20} user={item.author} />
            <span className="text-foreground font-medium">
              {item.author.name}
            </span>
            <span aria-hidden>·</span>
          </>
        )}
        <DateFormat date={item.createdAt} />
      </div>
      <h3 className="text-xl leading-tight font-bold">{item.title}</h3>
      {snippet && <p className="text-muted-foreground">{snippet}</p>}
    </>
  );

  return (
    <li className="flex gap-4">
      <div className="flex flex-col items-center gap-2">
        <TooltipWithContent text={t(renderer.labelKey)}>
          <span className="bg-muted/50 text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg border shadow-sm">
            <Icon className="size-4" />
          </span>
        </TooltipWithContent>
        {!isLast && <span className="bg-border w-px grow" />}
      </div>

      <div className={cn("min-w-0 flex-1", !isLast && "pb-8")}>
        {item.url ? (
          <ResultLink
            className="hover:bg-muted/50 flex flex-col gap-1 rounded-lg border p-4 transition-colors"
            href={item.url}
            LinkComponent={LinkComponent}
          >
            {content}
          </ResultLink>
        ) : (
          <div className="flex flex-col gap-1 rounded-lg border p-4">
            {content}
          </div>
        )}
      </div>
    </li>
  );
};

const SearchResultCard = ({
  LinkComponent,
  item,
}: {
  item: SearchResultItem;
  LinkComponent: SearchFeedLinkComponent;
}) => {
  const t = useTranslations("core.search");
  const renderer = getSearchTypeRenderer(item.itemType);
  const Icon = renderer.icon;
  const snippet = getSnippet(item.content);

  return (
    <Card>
      <CardContent className="flex gap-3">
        {item.author ? (
          <Avatar size={40} user={item.author} />
        ) : (
          <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
            <Icon className="size-5" />
          </span>
        )}

        <div className="flex min-w-0 flex-col gap-1">
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
            <span className="bg-muted inline-flex items-center gap-1 rounded px-1.5 py-0.5">
              <Icon className="size-3.5" />
              {t(renderer.labelKey)}
            </span>
            {item.author && (
              <span className="text-foreground font-medium">
                {item.author.name}
              </span>
            )}
            <DateFormat date={item.createdAt} />
          </div>

          <h3 className="text-foreground truncate text-lg font-semibold">
            <ItemTitle item={item} LinkComponent={LinkComponent} />
          </h3>

          {snippet && (
            <p className="text-muted-foreground line-clamp-2 text-sm">
              {snippet}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * The cache entry one feed reads and writes.
 *
 * Exported because the component is not always the first to ask for this data.
 * A framework that prefetches - a TanStack Start route loader, say - has to warm
 * *this* key or the feed will mount, miss, and fetch page one a second time. The
 * transport is deliberately not exported with it: the browser reaches the API
 * directly through `fetcherClient`, and a loader running on the server cannot,
 * so each side brings its own `queryFn` to the same key.
 *
 * `params` before `locale` is the order it has always been in; changing it would
 * silently orphan every entry a running client already holds.
 */
export const searchFeedQueryKey = ({
  locale,
  params,
}: {
  locale: string;
  params: SearchFeedParams;
}) => ["search", params, locale] as const;

const buildQuery = (
  params: SearchFeedParams,
  cursor: string,
): Record<string, string> => {
  const query: Record<string, string> = { first: "20" };
  if (params.search) query.search = params.search;
  if (params.types) query.types = params.types;
  if (params.authorId) query.authorId = params.authorId;
  if (params.sort) query.sort = params.sort;
  if (params.from) query.from = params.from;
  if (params.to) query.to = params.to;
  if (cursor) query.cursor = cursor;

  return query;
};

/**
 * The search feed, with nothing framework-shaped left in it.
 *
 * This is the whole of the rendering and paging behaviour - infinite scroll, the
 * load-more fallback, both variants, the empty and loading states - and it runs
 * unchanged under Next.js and under TanStack Start. Two things were pulled out
 * to make that true, and they are the only two that ever needed to be:
 *
 * - **`locale`** is a prop. It used to come from `next-intl`'s `useLocale()`,
 *   which reads Next's request scope; TanStack Start resolves the same answer
 *   from the router. Passing it in also makes the query key honest: the locale
 *   is part of what was fetched, so the component that fetches should be told
 *   it rather than reaching for ambient state that a test cannot set.
 * - **`LinkComponent`** is a prop. See {@link SearchFeedLinkComponent}.
 *
 * Translations come from `use-intl` directly - the framework-free half of
 * `next-intl`, and the same instance `NextIntlClientProvider` provides into, so
 * the Next.js app needs no extra provider for this to work.
 */
export const SearchFeedContent = ({
  LinkComponent,
  initialData,
  locale,
  params,
  variant = "list",
}: {
  initialData?: SearchFeedPage;
  LinkComponent: SearchFeedLinkComponent;
  locale: string;
  params: SearchFeedParams;
  variant?: SearchFeedVariant;
}) => {
  const t = useTranslations("core.search");
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: searchFeedQueryKey({ locale, params }),
      initialPageParam: "",
      queryFn: async ({ pageParam }) => {
        const res = await fetcherClient(searchRef, {
          module: "search",
          path: "/",
          method: "get",
          args: { query: { ...buildQuery(params, pageParam), lang: locale } },
        });

        return await res.json();
      },
      getNextPageParam: last =>
        last.pageInfo.hasNextPage ? String(last.pageInfo.endCursor) : undefined,
      initialData: initialData
        ? { pages: [initialData], pageParams: [""] }
        : undefined,
    });

  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;

    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting && !isFetchingNextPage) {
        void fetchNextPage();
      }
    });
    observer.observe(el);

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const items = data?.pages.flatMap(page => page.edges) ?? [];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {["a", "b", "c"].map(id => (
          <Skeleton className="h-24 w-full rounded-xl" key={id} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center">{t("empty")}</p>
    );
  }

  const loadMore = (
    <>
      <div ref={sentinelRef} />

      {hasNextPage && (
        <Button
          className="mx-auto"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
          variant="outline"
        >
          {isFetchingNextPage ? t("loading") : t("loadMore")}
        </Button>
      )}
    </>
  );

  if (variant === "timeline") {
    return (
      <div className="flex flex-col gap-4">
        <ol className="flex flex-col">
          {items.map((item, index) => (
            <TimelineItem
              isLast={index === items.length - 1}
              item={item}
              key={`${item.itemType}-${item.itemId}`}
              LinkComponent={LinkComponent}
            />
          ))}
        </ol>

        {loadMore}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map(item => (
        <SearchResultCard
          item={item}
          key={`${item.itemType}-${item.itemId}`}
          LinkComponent={LinkComponent}
        />
      ))}

      {loadMore}
    </div>
  );
};
