"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import React from "react";
import { useTranslations } from "use-intl";

import { Avatar } from "@/components/avatar";
import { DateFormat } from "@/components/date-format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { SearchFeedQueryOptions } from "./search-feed-query";
import type { SearchResultItem } from "./types";

import { getSearchTypeRenderer } from "./registry";

const SNIPPET_LENGTH = 240;

export type SearchFeedVariant = "list" | "timeline";

/**
 * Re-exported so `search-feed.tsx` and `search-controls.tsx` keep importing
 * their parameter type from where they always have. The definition now lives
 * with the query it parameterises.
 */
export type {
  SearchFeedParams,
  SearchFeedQueryOptions,
} from "./search-feed-query";
export { searchFeedQueryKey } from "./search-feed-query";

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
 * The schemes a search result is allowed to link to.
 *
 * An allowlist rather than a denylist, and that direction is the whole point. A
 * search document's `url` is written by whichever plugin indexed it, so this is
 * data, not code - and the previous rule ("anything with a scheme is external,
 * render it in an `<a href>`") happily passed `javascript:` and
 * `data:text/html,...` straight through. React 19 blocks `javascript:` at
 * render, but that is React's backstop, not this component's policy, and it
 * covers neither `data:` nor whatever the next scheme turns out to be.
 *
 * `mailto:` and `tel:` are here because a plugin indexing a contact record has
 * a real reason to emit them. Anything outside this set is refused.
 */
const SAFE_EXTERNAL_SCHEMES: ReadonlySet<string> = new Set([
  "http:",
  "https:",
  "mailto:",
  "tel:",
]);

/**
 * Control characters and spaces removed, because they hide a scheme:
 * `java\nscript:` and `\u0000javascript:` are both followed by a browser.
 *
 * Written as a code-point filter rather than a regular expression: a character
 * class containing a literal NUL is what `no-control-regex` exists to catch,
 * and the intent - "drop anything at or below a space" - reads better this way.
 */
const withoutControlCharacters = (value: string): string =>
  [...value].filter(char => (char.codePointAt(0) ?? 0) > 0x20).join("");

export type SearchFeedHrefKind = "external" | "internal" | "unsafe";

/**
 * What kind of destination an indexed `url` is.
 *
 * - `internal` - a path this app routes. The framework's `LinkComponent` gets it.
 * - `external` - an allowlisted scheme, or a protocol-relative `//host/path`
 *   (kept because it is existing behaviour). A bare `<a>` gets it; no router
 *   would accept it anyway.
 * - `unsafe` - everything else. Nothing gets it: {@link ResultLink} renders the
 *   title as text. A result that cannot be linked to safely is still a result.
 *
 * Exported for the tests, which is the only way to state the policy directly
 * rather than through rendered markup.
 */
export const classifySearchFeedHref = (href: string): SearchFeedHrefKind => {
  const cleaned = withoutControlCharacters(href);

  // Protocol-relative. Checked before the scheme test, which would not match it.
  if (cleaned.startsWith("//")) return "external";
  // A path, absolute or relative - no scheme to vet.
  if (!/^[a-z][a-z\d+\-.]*:/i.test(cleaned)) return "internal";

  const scheme = cleaned.slice(0, cleaned.indexOf(":") + 1).toLowerCase();

  return SAFE_EXTERNAL_SCHEMES.has(scheme) ? "external" : "unsafe";
};

/**
 * A result's destination, rendered by whatever is allowed to render it.
 *
 * An `unsafe` href falls back to the children with no anchor at all, so a
 * hostile document degrades to plain text instead of to a link nobody should
 * click - and, just as importantly, is never handed to a router either.
 */
const ResultLink = ({
  LinkComponent,
  children,
  className,
  href,
}: SearchFeedLinkProps & { LinkComponent: SearchFeedLinkComponent }) => {
  const kind = classifySearchFeedHref(href);

  if (kind === "unsafe") return <span className={className}>{children}</span>;

  if (kind === "external") {
    return (
      <a className={className} href={href}>
        {children}
      </a>
    );
  }

  return (
    <LinkComponent className={className} href={href}>
      {children}
    </LinkComponent>
  );
};

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
 * The search feed, with nothing framework-shaped left in it.
 *
 * This is the whole of the rendering and paging behaviour - infinite scroll, the
 * load-more fallback, both variants, the empty and loading states - and it runs
 * unchanged under Next.js and under TanStack Start. Exactly two things are
 * pulled out, and they are the only two that ever needed to be:
 *
 * - **`queryOptions`**, built by `searchFeedQueryOptions`. There is one
 *   `useInfiniteQuery` in this file and it is handed its definition, so the page
 *   a route loader prefetched and the page `fetchNextPage()` asks for come from
 *   the same request, the same cursor rule and the same status checking. This
 *   component used to build its own, which agreed with a loader on the cache key
 *   and on nothing else - a 400 on page two was parsed as a page and the feed
 *   quietly emptied itself. The locale and the search parameters left with it,
 *   because both are things the *query* needs rather than the markup.
 * - **`LinkComponent`**. See {@link SearchFeedLinkComponent}.
 *
 * Translations come from `use-intl` directly - the framework-free half of
 * `next-intl`, and the same instance `NextIntlClientProvider` provides into, so
 * the Next.js app needs no extra provider for this to work.
 */
export const SearchFeedContent = ({
  LinkComponent,
  queryOptions,
  variant = "list",
}: {
  LinkComponent: SearchFeedLinkComponent;
  queryOptions: SearchFeedQueryOptions;
  variant?: SearchFeedVariant;
}) => {
  const t = useTranslations("core.search");
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery(queryOptions);

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
