import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import React from "react";
import { useFormatter, useTranslations } from "use-intl";
import { z } from "zod";

import { Avatar } from "@/components/avatar";
import { DateFormat } from "@/components/date-format";
import { HiddenIcon } from "@/components/hidden-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { userProfileHref } from "@/components/user-format";

import type { SearchActivityKey } from "./registry";
import type { SearchFeedQueryOptions } from "./search-feed-query";
import type {
  SearchFeedPage,
  SearchResultAuthor,
  SearchResultItem,
} from "./types";

import { getSearchTypeRenderer } from "./registry";

const SNIPPET_LENGTH = 240;

export type SearchFeedVariant = "list" | "timeline";

export type {
  SearchFeedParams,
  SearchFeedQueryOptions,
} from "./search-feed-query";
export { searchFeedQueryKey } from "./search-feed-query";

export interface SearchFeedLinkProps {
  children: React.ReactNode;
  className?: string;
  href: string;
}

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
 * - `internal` - a path this app routes. The router's `Link` gets it.
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

const ResultLink = ({ children, className, href }: SearchFeedLinkProps) => {
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
    <Link className={className} href={href} to={href}>
      {children}
    </Link>
  );
};

const ItemTitle = ({ item }: { item: SearchResultItem }) =>
  item.url ? (
    <ResultLink className="hover:underline" href={item.url}>
      {item.title}
    </ResultLink>
  ) : (
    <>{item.title}</>
  );

const ItemHiddenIcon = ({
  className,
  focusable,
  item,
}: {
  className?: string;
  focusable?: boolean;
  item: SearchResultItem;
}) => {
  const t = useTranslations("core.search");
  if (!item.isHidden) return null;

  return (
    <HiddenIcon
      className={className}
      focusable={focusable}
      label={t("hidden", {
        type: t(getSearchTypeRenderer(item.itemType).labelKey),
      })}
    />
  );
};

const MAX_SHOWN_AUTHORS = 3;

const authorsOf = (item: SearchResultItem): SearchResultAuthor[] =>
  item.authors.length > 0 ? item.authors : item.author ? [item.author] : [];

const AuthorNames = ({ authors }: { authors: SearchResultAuthor[] }) => {
  const t = useTranslations("core.search");
  const format = useFormatter();
  const shown =
    authors.length > MAX_SHOWN_AUTHORS
      ? authors.slice(0, MAX_SHOWN_AUTHORS - 1)
      : authors;
  const rest = authors.length - shown.length;

  return (
    <span className="text-foreground font-medium">
      {format.list([
        ...shown.map(author => author.name),
        ...(rest > 0 ? [t("more_authors", { count: rest })] : []),
      ])}
    </span>
  );
};

const AuthorAvatars = ({ authors }: { authors: SearchResultAuthor[] }) => (
  <span aria-hidden className="flex shrink-0 items-center">
    {authors.slice(0, MAX_SHOWN_AUTHORS).map((author, index) => (
      <Avatar
        alt=""
        className={cn("ring-background ring-2", index > 0 && "-ms-1.5")}
        key={author.id}
        size={20}
        user={author}
      />
    ))}
  </span>
);

const ResultImage = ({ image }: { image: SearchResultItem["image"] }) =>
  image ? (
    <img
      alt=""
      className="bg-muted aspect-video w-full shrink-0 rounded-md object-cover sm:w-40"
      decoding="async"
      height={image.height}
      loading="lazy"
      src={image.url}
      width={image.width}
    />
  ) : null;

const zodActivityContext = z.object({
  context: z.object({ title: z.string().min(1), url: z.string().nullable() }),
});

interface SearchActivity {
  context: { title: string; url: null | string };
  key: SearchActivityKey;
}

const activityOf = (item: SearchResultItem): null | SearchActivity => {
  const { activityKey } = getSearchTypeRenderer(item.itemType);
  if (!activityKey) return null;

  const parsed = zodActivityContext.safeParse(item.metadata);

  return parsed.success
    ? { context: parsed.data.context, key: activityKey }
    : null;
};

const ActivityLink = ({
  children,
  href,
}: {
  children: React.ReactNode;
  href: null | string;
}) =>
  href ? (
    <ResultLink
      className="text-foreground relative z-10 font-medium hover:underline"
      href={href}
    >
      {children}
    </ResultLink>
  ) : (
    <span className="text-foreground font-medium">{children}</span>
  );

const CARD_OVERLAY_LINK =
  "after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring";

const ActivitySentence = ({
  activity,
  authors,
  item,
}: {
  activity: SearchActivity;
  authors: SearchResultAuthor[];
  item: SearchResultItem;
}) => {
  const t = useTranslations("core.search");
  const format = useFormatter();
  const [onlyAuthor] = authors.length === 1 ? authors : [];

  return (
    <span className="min-w-0 text-pretty">
      {t.rich(activity.key, {
        author: format.list(authors.map(author => author.name)),
        context: activity.context.title,
        item: item.title,
        link: chunks => <ActivityLink href={item.url}>{chunks}</ActivityLink>,
        profile: chunks => (
          <ActivityLink
            href={onlyAuthor ? userProfileHref(onlyAuthor.nameCode) : null}
          >
            {chunks}
          </ActivityLink>
        ),
        target: chunks => (
          <ActivityLink href={activity.context.url}>{chunks}</ActivityLink>
        ),
      })}
    </span>
  );
};

const ActivityBody = ({
  className,
  item,
  snippet,
}: {
  className?: string;
  item: SearchResultItem;
  snippet: string;
}) => {
  if (item.url && !snippet) {
    return (
      <ResultLink className={CARD_OVERLAY_LINK} href={item.url}>
        <span className="sr-only">{item.title}</span>
      </ResultLink>
    );
  }
  if (!snippet) return null;

  return item.url ? (
    <ResultLink
      className={cn(
        "text-foreground leading-relaxed",
        CARD_OVERLAY_LINK,
        className,
      )}
      href={item.url}
    >
      {snippet}
    </ResultLink>
  ) : (
    <p className={cn("text-foreground leading-relaxed", className)}>
      {snippet}
    </p>
  );
};

const DraftBadge = () => {
  const t = useTranslations("core.search");

  return <Badge variant="warning">{t("draft")}</Badge>;
};

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
  const authors = authorsOf(item);
  const activity = activityOf(item);

  const activityContent = activity ? (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {authors.length > 0 && <AuthorAvatars authors={authors} />}
        <ActivitySentence activity={activity} authors={authors} item={item} />
        <span aria-hidden className="max-sm:hidden">
          ·
        </span>
        <DateFormat date={item.createdAt} />
        <ItemHiddenIcon
          className="relative z-10 size-4"
          focusable
          item={item}
        />
        {!item.isPublic && !item.isHidden && <DraftBadge />}
      </div>
      <ActivityBody className="text-base" item={item} snippet={snippet} />
    </div>
  ) : null;

  const content = (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {authors.length > 0 && (
            <>
              <span className="flex min-w-0 items-center gap-2 max-sm:basis-full">
                <AuthorAvatars authors={authors} />
                <AuthorNames authors={authors} />
              </span>
              <span aria-hidden className="max-sm:hidden">
                ·
              </span>
            </>
          )}
          <DateFormat date={item.createdAt} />
          {!item.isPublic && !item.isHidden && <DraftBadge />}
        </div>
        <h3 className="flex items-center gap-2 text-xl leading-tight font-bold">
          <ItemHiddenIcon
            className="size-5"
            focusable={!item.url}
            item={item}
          />
          {item.title}
        </h3>
        {snippet && <p className="text-muted-foreground">{snippet}</p>}
      </div>
      <ResultImage image={item.image} />
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
        {activityContent ? (
          <div
            className={cn(
              "relative flex flex-col-reverse gap-3 rounded-lg border p-4 sm:flex-row sm:items-start",
              item.url && "hover:bg-muted/50 transition-colors",
            )}
          >
            {activityContent}
            <ResultImage image={item.image} />
          </div>
        ) : item.url ? (
          <ResultLink
            className="hover:bg-muted/50 flex flex-col-reverse gap-3 rounded-lg border p-4 transition-colors sm:flex-row sm:items-start"
            href={item.url}
          >
            {content}
          </ResultLink>
        ) : (
          <div className="flex flex-col-reverse gap-3 rounded-lg border p-4 sm:flex-row sm:items-start">
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
  const authors = authorsOf(item);
  const activity = activityOf(item);

  return (
    <Card
      className={cn(
        activity && item.url && "hover:bg-muted/50 relative transition-colors",
      )}
    >
      <CardContent className="flex flex-col-reverse gap-3 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 gap-3">
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
              {activity ? (
                <ActivitySentence
                  activity={activity}
                  authors={authors}
                  item={item}
                />
              ) : (
                authors.length > 0 && <AuthorNames authors={authors} />
              )}
              <DateFormat date={item.createdAt} />
              {!item.isPublic && !item.isHidden && <DraftBadge />}
            </div>

            {activity ? (
              <ActivityBody
                className="line-clamp-3 text-sm"
                item={item}
                snippet={snippet}
              />
            ) : (
              <>
                <h3 className="text-foreground flex min-w-0 items-center gap-2 text-lg font-semibold">
                  <ItemHiddenIcon className="size-4" item={item} />
                  <span className="truncate">
                    <ItemTitle item={item} />
                  </span>
                </h3>

                {snippet && (
                  <p className="text-muted-foreground line-clamp-2 text-sm">
                    {snippet}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        <ResultImage image={item.image} />
      </CardContent>
    </Card>
  );
};

export interface SearchFeedListQuery {
  data?: { pages: readonly SearchFeedPage[] };
  fetchNextPage: () => Promise<unknown>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
}

export const SearchFeedList = ({
  query: { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading },
  variant = "list",
}: {
  query: SearchFeedListQuery;
  variant?: SearchFeedVariant;
}) => {
  const t = useTranslations("core.search");
  const sentinelRef = React.useRef<HTMLDivElement>(null);

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

export const SearchFeedContent = ({
  queryOptions,
  variant = "list",
}: {
  queryOptions: SearchFeedQueryOptions;
  variant?: SearchFeedVariant;
}) => {
  const query = useInfiniteQuery(queryOptions);

  return <SearchFeedList query={query} variant={variant} />;
};
