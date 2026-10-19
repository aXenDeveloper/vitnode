import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import {
  ArrowRightIcon,
  ClockIcon,
  type LucideIcon,
  SearchIcon,
} from "lucide-react";
import React from "react";
import { useDebouncedCallback } from "use-debounce";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { getSearchTypeRenderer } from "@/views/search/registry";
import {
  searchHighlightPattern,
  searchHighlightWords,
  searchSnippetAround,
} from "@/views/search/search-highlight";
import { SearchHighlightText } from "@/views/search/search-highlight-text";
import { MIN_SEARCH_TERM_LENGTH } from "@/views/search/search-params";
import {
  recordSearchPopularity,
  SEARCH_SUGGEST_DEBOUNCE_MS,
  SEARCH_SUGGEST_MIN_LENGTH,
  searchPopularQueryOptions,
  searchSuggestQueryOptions,
} from "@/views/search/search-suggest-query";

import { useLocale } from "../i18n/locale";
import { GLOBAL_NAMESPACE } from "../i18n/query";
import { RouteMessages } from "../i18n/route-messages";
import {
  getSearchSources,
  type SearchSource,
  type SearchSourceItem,
  searchSourceQueryOptions,
} from "./sources";

const HEADER_SEARCH_NAMESPACES = [GLOBAL_NAMESPACE, "core.search"];

type SearchSourceLabelTranslator = (key: string) => string;

const RECENT_SEARCHES_KEY = "vitnode-search-recent";
const MAX_RECENT_SEARCHES = 5;
const EXCERPT_LENGTH = 120;
const SKELETON_ROWS = ["a", "b", "c"];

interface HeaderSearchItem {
  context: null | string;
  createdAt: Date | string;
  excerpt: string;
  id: number;
  image: null | { url: string };
  itemId: string;
  itemType: string;
  title: string;
  url: string;
}

type HeaderSearchEntry =
  | { id: string; item: HeaderSearchItem; kind: "item" }
  | { id: string; item: SearchSourceItem; kind: "source"; source: SearchSource }
  | { id: string; kind: "see-all" };

interface SearchSourceGroup {
  entries: Extract<HeaderSearchEntry, { kind: "source" }>[];
  source: SearchSource;
}

const isInternalPath = (url: string): boolean =>
  url.startsWith("/") && !url.startsWith("//");

const searchPageHref = (term: string): string =>
  `/search?${new URLSearchParams({ search: term }).toString()}`;

const optionId = (id: string) => `header-search-option-${id}`;

const readRecentSearches = (): string[] => {
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed)
      ? parsed
          .filter(entry => typeof entry === "string")
          .slice(0, MAX_RECENT_SEARCHES)
      : [];
  } catch {
    return [];
  }
};

const rememberRecentSearch = (term: string) => {
  try {
    window.localStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify(
        [term, ...readRecentSearches().filter(entry => entry !== term)].slice(
          0,
          MAX_RECENT_SEARCHES,
        ),
      ),
    );
  } catch {
    return;
  }
};

const AutoHeight = ({
  children,
  open,
}: {
  children: React.ReactNode;
  open: boolean;
}) => {
  const innerRef = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState(0);

  React.useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeight(entry.borderBoxSize[0]?.blockSize ?? 0);
    });
    observer.observe(inner);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="overflow-hidden transition-[height] duration-180 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
      style={{ height: open ? height : 0 }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
};

const IconThumbnail = ({ icon: Icon }: { icon: LucideIcon }) => (
  <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md">
    <Icon aria-hidden className="size-4" />
  </span>
);

const SourceItemThumbnail = ({
  fallback: FallbackIcon,
  item,
}: {
  fallback: LucideIcon;
  item: SearchSourceItem;
}) => {
  if (!item.icon) return <IconThumbnail icon={FallbackIcon} />;

  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-md",
        !item.color && "bg-muted text-muted-foreground",
      )}
      style={
        item.color
          ? {
              backgroundColor: `color-mix(in oklab, ${item.color} 14%, transparent)`,
              color: item.color,
            }
          : undefined
      }
    >
      <DynamicIcon
        className="size-4"
        fallback={<FallbackIcon aria-hidden className="size-4" />}
        name={item.icon}
      />
    </span>
  );
};

const ItemThumbnail = ({ item }: { item: HeaderSearchItem }) => {
  if (item.image) {
    return (
      <img
        alt=""
        className="bg-muted size-10 shrink-0 rounded-md object-cover outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
        decoding="async"
        loading="lazy"
        src={item.image.url}
      />
    );
  }

  return <IconThumbnail icon={getSearchTypeRenderer(item.itemType).icon} />;
};

const ItemRow = ({
  active,
  context,
  date,
  excerpt: fullExcerpt,
  optionProps,
  pattern,
  thumbnail,
  title,
}: {
  active: boolean;
  context?: null | string;
  date?: Date | string;
  excerpt?: null | string;
  optionProps: React.HTMLAttributes<HTMLDivElement>;
  pattern: null | RegExp;
  thumbnail: React.ReactNode;
  title: string;
}) => {
  const t = useTranslations("core.search");
  const excerpt = searchSnippetAround(
    fullExcerpt ?? "",
    pattern,
    EXCERPT_LENGTH,
  );

  return (
    <div
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2",
        active && "bg-muted",
      )}
      {...optionProps}
    >
      {thumbnail}
      <span className="flex min-h-10 min-w-0 flex-1 flex-col justify-center">
        <span className="flex items-baseline gap-2 text-sm">
          <span className="text-foreground min-w-0 truncate font-medium">
            <SearchHighlightText pattern={pattern} text={title} />
          </span>
          {context && context !== title && (
            <span className="text-muted-foreground min-w-0 shrink truncate text-xs">
              {t("dialog.in_context", { context })}
            </span>
          )}
          {date && (
            <span className="text-muted-foreground ms-auto shrink-0 text-xs">
              <DateFormat date={date} />
            </span>
          )}
        </span>
        {excerpt && (
          <span
            aria-hidden={!active}
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-150 ease-out motion-reduce:transition-none",
              active
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0",
            )}
          >
            <span className="min-h-0 overflow-hidden">
              <span className="text-muted-foreground line-clamp-2 pt-0.5 text-sm leading-relaxed">
                <SearchHighlightText pattern={pattern} text={excerpt} />
              </span>
            </span>
          </span>
        )}
      </span>
    </div>
  );
};

const ResultGroup = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) => {
  const labelId = React.useId();

  return (
    <div
      aria-labelledby={labelId}
      className="flex flex-col gap-0.5"
      role="group"
    >
      <div
        className="text-muted-foreground px-2 pt-1 pb-1.5 text-xs font-medium"
        id={labelId}
      >
        {label}
      </div>
      {children}
    </div>
  );
};

const HeaderSearchMorph = ({
  firstSourceId,
  onNavigate,
  open,
}: {
  firstSourceId?: string;
  onNavigate: (href: string) => void;
  open: boolean;
}) => {
  const t = useTranslations("core.search");
  const tGlobal = useTranslations("core.global");
  const tSource = useTranslations() as unknown as SearchSourceLabelTranslator;
  const locale = useLocale();
  const listId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [term, setTerm] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [recent] = React.useState(readRecentSearches);
  const debounceTerm = useDebouncedCallback(
    setTerm,
    SEARCH_SUGGEST_DEBOUNCE_MS,
  );

  const trimmedQuery = query.trim();
  const trimmedTerm = term.trim();
  const isSuggesting = trimmedQuery.length >= SEARCH_SUGGEST_MIN_LENGTH;
  const canSuggest =
    open && isSuggesting && trimmedTerm.length >= SEARCH_SUGGEST_MIN_LENGTH;

  const suggestions = useQuery({
    ...searchSuggestQueryOptions({ locale, term: trimmedTerm }),
    enabled: canSuggest,
    placeholderData: canSuggest ? keepPreviousData : undefined,
  });
  const popular = useQuery({
    ...searchPopularQueryOptions({ locale }),
    enabled: open,
  });
  const sources = getSearchSources();
  const sourceResults = useQueries({
    queries: sources.map(source => ({
      ...searchSourceQueryOptions({ locale, source, term: trimmedTerm }),
      enabled: canSuggest,
      placeholderData: canSuggest ? keepPreviousData : undefined,
    })),
  });

  const active = isSuggesting ? suggestions : popular;
  const items: HeaderSearchItem[] = (active.data ?? []).filter(item =>
    isInternalPath(item.url),
  );
  const sourceGroups: SearchSourceGroup[] = isSuggesting
    ? sources
        .map((source, index) => ({
          entries: (sourceResults[index]?.data ?? [])
            .filter(item => isInternalPath(item.url))
            .map(item => ({
              id: `source-${source.id}-${item.id}`,
              item,
              kind: "source" as const,
              source,
            })),
          source,
        }))
        .filter(group => group.entries.length > 0)
    : [];
  const leadingGroups = sourceGroups.filter(
    group => group.source.id === firstSourceId,
  );
  const trailingGroups = sourceGroups.filter(
    group => group.source.id !== firstSourceId,
  );
  const sourceEntries = sourceGroups.flatMap(group => group.entries);
  const isSourcePending =
    isSuggesting &&
    sourceResults.some(
      result => !result.data && (result.isFetching || !canSuggest),
    );
  const isLoading = isSuggesting
    ? (!suggestions.data && (suggestions.isFetching || !canSuggest)) ||
      (items.length === 0 && sourceEntries.length === 0 && isSourcePending)
    : popular.isPending;
  const resultCount = items.length + sourceEntries.length;
  const canSeeAll = trimmedQuery.length >= MIN_SEARCH_TERM_LENGTH;
  const pattern = isSuggesting
    ? searchHighlightPattern(searchHighlightWords(trimmedTerm))
    : null;

  const entries: HeaderSearchEntry[] = [
    ...leadingGroups.flatMap(group => group.entries),
    ...items.map(item => ({
      id: `item-${item.id}`,
      item,
      kind: "item" as const,
    })),
    ...trailingGroups.flatMap(group => group.entries),
    ...(canSeeAll ? [{ id: "see-all", kind: "see-all" as const }] : []),
  ];
  const activePosition = Math.max(0, Math.min(activeIndex, entries.length - 1));
  const activeEntry = entries[activePosition];

  const completion =
    isSuggesting && query.length > 0
      ? [...items, ...sourceEntries.map(entry => entry.item)].find(item =>
          item.title.toLowerCase().startsWith(query.toLowerCase()),
        )
      : undefined;
  const ghost = completion ? completion.title.slice(query.length) : "";

  const changeQuery = (value: string) => {
    setQuery(value);
    setActiveIndex(0);
    debounceTerm(value);
  };

  const select = (entry: HeaderSearchEntry) => {
    debounceTerm.cancel();
    if (trimmedQuery) rememberRecentSearch(trimmedQuery);

    if (entry.kind === "see-all") {
      onNavigate(searchPageHref(trimmedQuery));

      return;
    }
    if (entry.kind === "source") {
      onNavigate(entry.item.url);

      return;
    }

    void recordSearchPopularity({
      itemId: entry.item.itemId,
      itemType: entry.item.itemType,
      signal: "click",
    });
    onNavigate(entry.item.url);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const atEnd = event.currentTarget.selectionStart === query.length;
    const accepts =
      (event.key === "Tab" && !event.shiftKey) ||
      (event.key === "ArrowRight" && atEnd);

    if (accepts && completion) {
      event.preventDefault();
      changeQuery(completion.title);

      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex(Math.min(activePosition + 1, entries.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(Math.max(activePosition - 1, 0));
    } else if (event.key === "Enter" && activeEntry) {
      event.preventDefault();
      select(activeEntry);
    }
  };

  const optionProps = (
    entry: HeaderSearchEntry,
    position: number,
  ): React.HTMLAttributes<HTMLDivElement> => ({
    "aria-selected": activeEntry?.id === entry.id,
    id: `${listId}-${optionId(entry.id)}`,
    onClick: () => select(entry),
    onMouseMove: () => setActiveIndex(position),
    role: "option",
  });

  const showRecent = !isSuggesting && recent.length > 0;
  const expanded =
    isLoading || entries.length > 0 || isSuggesting || active.isError;
  const positionOf = (entry: HeaderSearchEntry) => entries.indexOf(entry);

  const renderSourceGroup = (group: SearchSourceGroup) => (
    <ResultGroup key={group.source.id} label={tSource(group.source.labelKey)}>
      {group.entries.map(entry => (
        <ItemRow
          active={activeEntry?.id === entry.id}
          context={entry.item.context}
          excerpt={entry.item.excerpt}
          key={entry.id}
          optionProps={optionProps(entry, positionOf(entry))}
          pattern={pattern}
          thumbnail={
            <SourceItemThumbnail
              fallback={group.source.icon}
              item={entry.item}
            />
          }
          title={entry.item.title}
        />
      ))}
    </ResultGroup>
  );

  return (
    <div className="bg-popover/80 text-popover-foreground ring-foreground/10 overflow-hidden rounded-2xl shadow-2xl ring-1 backdrop-blur-sm">
      <div className="flex h-14 items-center gap-3 px-4 sm:h-16 sm:px-5">
        <SearchIcon
          aria-hidden
          className="text-muted-foreground size-5 shrink-0 sm:size-6"
        />
        <div className="relative min-w-0 flex-1">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center overflow-hidden text-lg whitespace-pre sm:text-xl"
          >
            <span className="invisible">{query}</span>
            <span className="text-muted-foreground/50">{ghost}</span>
          </span>
          <input
            aria-activedescendant={
              activeEntry ? `${listId}-${optionId(activeEntry.id)}` : undefined
            }
            aria-autocomplete="both"
            aria-controls={listId}
            aria-expanded={expanded}
            aria-label={t("dialog.label")}
            autoComplete="off"
            autoFocus
            className="placeholder:text-muted-foreground relative w-full bg-transparent text-lg outline-none sm:text-xl"
            maxLength={100}
            onChange={event => changeQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={tGlobal("search_placeholder")}
            ref={inputRef}
            role="combobox"
            spellCheck={false}
            type="text"
            value={query}
          />
        </div>
        {ghost && (
          <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs max-sm:hidden">
            <Kbd>Tab</Kbd>
            {t("dialog.complete")}
          </span>
        )}
      </div>

      <div aria-live="polite" className="sr-only">
        {isLoading ? t("loading") : t("dialog.count", { count: resultCount })}
      </div>

      {showRecent && (
        <div className="flex flex-wrap items-center gap-1.5 border-t px-4 py-3 sm:px-5">
          <ClockIcon
            aria-label={t("dialog.recent")}
            className="text-muted-foreground size-3.5"
            role="img"
          />
          {recent.map(entry => (
            <button
              className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring h-7 rounded-full px-2.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
              key={entry}
              onClick={() => {
                changeQuery(entry);
                inputRef.current?.focus();
              }}
              type="button"
            >
              {entry}
            </button>
          ))}
        </div>
      )}

      <AutoHeight open={expanded}>
        <div className="max-h-[min(28rem,60vh)] overflow-y-auto border-t p-2">
          {isLoading ? (
            <div aria-hidden className="flex flex-col gap-1 p-1">
              {SKELETON_ROWS.map(id => (
                <div className="flex items-center gap-3 p-1" key={id}>
                  <Skeleton className="size-10 shrink-0 rounded-md" />
                  <Skeleton className="h-4 w-full rounded-sm" />
                </div>
              ))}
            </div>
          ) : (
            resultCount === 0 && (
              <p className="text-muted-foreground px-3 py-6 text-center text-sm leading-relaxed text-pretty">
                {active.isError
                  ? t("dialog.error")
                  : isSuggesting
                    ? t("dialog.no_results")
                    : t("dialog.popular_empty")}
              </p>
            )
          )}
          <div
            aria-label={t("dialog.label")}
            className="flex flex-col gap-2"
            id={listId}
            role="listbox"
          >
            {!isLoading && leadingGroups.map(renderSourceGroup)}
            {!isLoading && items.length > 0 && (
              <ResultGroup
                label={
                  isSuggesting ? t("dialog.suggestions") : t("dialog.popular")
                }
              >
                {entries.map(
                  entry =>
                    entry.kind === "item" && (
                      <ItemRow
                        active={activeEntry?.id === entry.id}
                        context={entry.item.context}
                        date={entry.item.createdAt}
                        excerpt={entry.item.excerpt}
                        key={entry.id}
                        optionProps={optionProps(entry, positionOf(entry))}
                        pattern={pattern}
                        thumbnail={<ItemThumbnail item={entry.item} />}
                        title={entry.item.title}
                      />
                    ),
                )}
              </ResultGroup>
            )}
            {!isLoading && trailingGroups.map(renderSourceGroup)}
            {!isLoading &&
              entries.map(
                entry =>
                  entry.kind === "see-all" && (
                    <div
                      className={cn(
                        "text-primary flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium",
                        activeEntry?.id === entry.id && "bg-muted",
                      )}
                      key={entry.id}
                      {...optionProps(entry, positionOf(entry))}
                    >
                      <ArrowRightIcon aria-hidden className="size-4" />
                      {t("dialog.see_all", { term: trimmedQuery })}
                    </div>
                  ),
              )}
          </div>
        </div>
      </AutoHeight>

      <footer className="text-muted-foreground flex items-center gap-4 border-t px-5 py-2.5 text-xs max-sm:hidden">
        <span className="flex items-center gap-1.5">
          <KbdGroup>
            <Kbd aria-label={t("dialog.key_up")}>↑</Kbd>
            <Kbd aria-label={t("dialog.key_down")}>↓</Kbd>
          </KbdGroup>
          {t("dialog.navigate")}
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd aria-label={t("dialog.key_enter")}>↵</Kbd>
          {t("dialog.open")}
        </span>
        <span className="ms-auto flex items-center gap-1.5">
          <Kbd>Esc</Kbd>
          {t("dialog.close")}
        </span>
      </footer>
    </div>
  );
};

export const HeaderSearchContent = ({
  firstSourceId,
  onNavigate,
  open,
}: {
  firstSourceId?: string;
  onNavigate: (href: string) => void;
  open: boolean;
}) => (
  <RouteMessages
    namespaces={[
      ...new Set([
        ...HEADER_SEARCH_NAMESPACES,
        ...getSearchSources().map(source => source.namespace),
      ]),
    ]}
  >
    <HeaderSearchMorph
      firstSourceId={firstSourceId}
      onNavigate={onNavigate}
      open={open}
    />
  </RouteMessages>
);
