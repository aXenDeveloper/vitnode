import { cn } from "cn";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import React from "react";
import { useDebouncedCallback } from "use-debounce";
import { useTranslations } from "use-intl";

import { tablePageWindow } from "@/components/table/page-window";
import { buttonVariants } from "@/components/ui/button";
import {
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";

import { HrefLink } from "../link/href-link";

/** How long a list's search field waits after a keystroke, like the site search. */
export const CONTENT_LIST_SEARCH_DEBOUNCE_MS = 500;

/** The `pageInfo` fields public list pagination reads. */
export interface ContentListPageInfo {
  count: number;
  currentPage: null | number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/**
 * Numbered pagination for a public list, read straight off the list route's
 * `pageInfo`: previous and next, every page on wider screens (with gaps past
 * seven), and "Page 2 of 9" on narrow ones. Every page is a real link, so it
 * works before hydration and crawlers can follow it. Renders nothing for a
 * single page.
 *
 * `hrefFor` builds a page's internal path - `list.href(pathname, { ...search,
 * page })` from `defineContentList` - and links go through `HrefLink`, so the
 * locale prefix is added for you.
 *
 * @example
 * ```tsx
 * import { ContentListPagination } from "@vitnode/core/tanstack/content";
 *
 * <ContentListPagination
 *   hrefFor={page => articleList.href("/news", { ...search, page })}
 *   label={t("pagination")}
 *   pageInfo={data.pageInfo}
 * />;
 * ```
 */
export const ContentListPagination = ({
  className,
  hrefFor,
  label,
  onNavigate,
  pageInfo: { currentPage, hasNextPage, hasPreviousPage, totalPages },
}: {
  className?: string;
  hrefFor: (page: number) => string;
  /** The `<nav>`'s accessible name. Defaults to the translated "Pagination". */
  label?: string;
  /** Called on a page link click, e.g. to start a transition. */
  onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  pageInfo: ContentListPageInfo;
}) => {
  const t = useTranslations("core.global");
  const page = currentPage ?? 1;

  if (totalPages <= 1) return null;

  const step = (
    target: number,
    enabled: boolean,
    direction: "next" | "previous",
  ) => {
    const content =
      direction === "previous" ? (
        <>
          <ChevronLeftIcon aria-hidden="true" className="rtl:rotate-180" />
          <span className="hidden sm:block">{t("previous")}</span>
        </>
      ) : (
        <>
          <span className="hidden sm:block">{t("next")}</span>
          <ChevronRightIcon aria-hidden="true" className="rtl:rotate-180" />
        </>
      );
    const className = buttonVariants({ variant: "ghost" });
    const name = t(direction === "previous" ? "previous_page" : "next_page");

    return enabled ? (
      <HrefLink
        aria-label={name}
        className={className}
        href={hrefFor(target)}
        onClick={onNavigate}
        rel={direction === "previous" ? "prev" : "next"}
      >
        {content}
      </HrefLink>
    ) : (
      <button aria-label={name} className={className} disabled type="button">
        {content}
      </button>
    );
  };

  return (
    <nav
      aria-label={label ?? t("pagination")}
      className={cn("flex w-full justify-center", className)}
    >
      <PaginationContent className="flex-wrap justify-center">
        <PaginationItem>
          {step(page - 1, hasPreviousPage, "previous")}
        </PaginationItem>

        <PaginationItem className="sm:hidden">
          <span className="text-muted-foreground px-2 text-sm tabular-nums">
            {t("page_of", { page, total: totalPages })}
          </span>
        </PaginationItem>

        {tablePageWindow({ current: page, total: totalPages }).map(
          (slot, index) => (
            <PaginationItem
              className="hidden sm:block"
              key={
                slot === "ellipsis"
                  ? `gap-${index === 1 ? "start" : "end"}`
                  : slot
              }
            >
              {slot === "ellipsis" ? (
                <PaginationEllipsis />
              ) : (
                <HrefLink
                  aria-current={slot === page ? "page" : undefined}
                  className={cn(
                    buttonVariants({
                      size: "icon",
                      variant: slot === page ? "outline" : "ghost",
                    }),
                    "w-auto min-w-9 px-2 tabular-nums",
                  )}
                  href={hrefFor(slot)}
                  onClick={onNavigate}
                >
                  {slot}
                </HrefLink>
              )}
            </PaginationItem>
          ),
        )}

        <PaginationItem>{step(page + 1, hasNextPage, "next")}</PaginationItem>
      </PaginationContent>
    </nav>
  );
};

/**
 * The value of a list's search field, kept apart from the URL while somebody
 * types: `onCommit` runs once typing pauses for `delay` ms (or at once with
 * `commit()`, e.g. on Enter), with the trimmed term or `undefined` when empty.
 * When the URL's term changes on its own - back, forward, a "clear filters"
 * link - the field follows it. Browser-side state; renders the URL's value on
 * the server.
 *
 * @example
 * ```tsx
 * import { useContentListSearchInput } from "@vitnode/core/tanstack/content";
 *
 * const input = useContentListSearchInput({
 *   onCommit: q => update({ q }),
 *   value: search.q,
 * });
 *
 * <input
 *   onChange={event => input.setValue(event.target.value)}
 *   onKeyDown={event => event.key === "Enter" && input.commit()}
 *   type="search"
 *   value={input.value}
 * />;
 * ```
 */
export const useContentListSearchInput = ({
  delay = CONTENT_LIST_SEARCH_DEBOUNCE_MS,
  onCommit,
  value,
}: {
  delay?: number;
  onCommit: (term: string | undefined) => void;
  /** The term the URL currently holds. */
  value: string | undefined;
}) => {
  const [draft, setDraft] = React.useState(value ?? "");
  const [committed, setCommitted] = React.useState(value);

  // Adjusted during render rather than in an effect, so the field never shows
  // a stale term for a frame after back or forward.
  if (committed !== value) {
    setCommitted(value);
    if ((value ?? "") !== draft.trim()) setDraft(value ?? "");
  }

  const debounced = useDebouncedCallback((next: string) => {
    const term = next.trim() === "" ? undefined : next.trim();
    if (term !== value) onCommit(term);
  }, delay);

  return {
    /** Commits the current value now, skipping the wait. */
    commit: () => {
      debounced(draft);
      debounced.flush();
    },
    setValue: (next: string) => {
      setDraft(next);
      debounced(next);
    },
    value: draft,
  };
};

/**
 * The body of a public list: one of its five states, decided in one place.
 *
 * - `items` is `undefined` while the first page loads, and `loading` renders.
 * - `isError` without items renders `error`.
 * - No items renders `empty` when nothing narrows the list, and `noResults`
 *   when `isFiltered` - "nothing published yet" and "nothing matches" are
 *   different messages, and only the second one wants a "clear filters".
 * - Otherwise each item is rendered with `renderItem` inside a `<ul>`; `as`
 *   switches to `<ol>`. `isFetching` marks the list `aria-busy` and dims it
 *   while the next page loads over the previous one.
 *
 * Item rendering, layout classes and every label stay with the caller.
 *
 * @example
 * ```tsx
 * import { ContentListResults } from "@vitnode/core/tanstack/content";
 *
 * <ContentListResults
 *   className="grid gap-6 md:grid-cols-2"
 *   empty={<p>{t("empty")}</p>}
 *   error={<p>{t("error")}</p>}
 *   getKey={article => article.id}
 *   isFiltered={articleList.isFiltered(search)}
 *   items={data?.edges}
 *   label={t("articles")}
 *   loading={<p>{t("loading")}</p>}
 *   noResults={<p>{t("no_results")}</p>}
 *   renderItem={article => <ArticleCard article={article} />}
 * />;
 * ```
 */
export const ContentListResults = <TItem,>({
  as: List = "ul",
  className,
  empty,
  error,
  getKey,
  isError = false,
  isFetching = false,
  isFiltered,
  itemClassName,
  items,
  label,
  loading,
  noResults,
  renderItem,
}: {
  as?: "ol" | "ul";
  className?: string;
  empty: React.ReactNode;
  error: React.ReactNode;
  getKey: (item: TItem) => React.Key;
  isError?: boolean;
  isFetching?: boolean;
  isFiltered: boolean;
  itemClassName?: string;
  items: readonly TItem[] | undefined;
  /** The list's accessible name. */
  label: string;
  loading: React.ReactNode;
  noResults: React.ReactNode;
  renderItem: (item: TItem, index: number) => React.ReactNode;
}): React.JSX.Element => {
  if (items === undefined) return <>{isError ? error : loading}</>;
  if (items.length === 0) return <>{isFiltered ? noResults : empty}</>;

  return (
    <List
      aria-busy={isFetching}
      aria-label={label}
      className={cn(
        "transition-opacity",
        isFetching && "opacity-60 motion-reduce:transition-none",
        className,
      )}
    >
      {items.map((item, index) => (
        <li className={itemClassName} key={getKey(item)}>
          {renderItem(item, index)}
        </li>
      ))}
    </List>
  );
};
