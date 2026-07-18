"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import React from "react";

import type { searchModule } from "@/api/modules/search/search.module";

import { Avatar } from "@/components/avatar";
import { DateFormat } from "@/components/date-format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { CONFIG_PLUGIN } from "@/config";
import { clientModule, fetcherClient } from "@/lib/fetcher-client";
import { Link } from "@/lib/navigation";
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

const getSnippet = (content: string): string =>
  content.length > SNIPPET_LENGTH
    ? `${content.slice(0, SNIPPET_LENGTH).trimEnd()}…`
    : content;

const ItemTitle = ({ item }: { item: SearchResultItem }) =>
  item.url ? (
    <Link className="hover:underline" href={item.url}>
      {item.title}
    </Link>
  ) : (
    <>{item.title}</>
  );

const TimelineItem = ({
  item,
  isLast,
}: {
  isLast: boolean;
  item: SearchResultItem;
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
          <Link
            className="hover:bg-muted/50 flex flex-col gap-1 rounded-lg border p-4 transition-colors"
            href={item.url}
          >
            {content}
          </Link>
        ) : (
          <div className="flex flex-col gap-1 rounded-lg border p-4">
            {content}
          </div>
        )}
      </div>
    </li>
  );
};

const SearchResultCard = ({ item }: { item: SearchResultItem }) => {
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
            <ItemTitle item={item} />
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

export const SearchFeed = ({
  params,
  initialData,
  variant = "list",
}: {
  initialData?: SearchFeedPage;
  params: SearchFeedParams;
  variant?: SearchFeedVariant;
}) => {
  const t = useTranslations("core.search");
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["search", params],
    initialPageParam: "",
    queryFn: async ({ pageParam }) => {
      const res = await fetcherClient(searchRef, {
        module: "search",
        path: "/",
        method: "get",
        args: { query: buildQuery(params, pageParam) },
      });

      return (await res.json()) as SearchFeedPage;
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
        <SearchResultCard item={item} key={`${item.itemType}-${item.itemId}`} />
      ))}

      {loadMore}
    </div>
  );
};
