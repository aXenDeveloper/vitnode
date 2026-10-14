import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import React from "react";
import { useDebouncedCallback } from "use-debounce";
import { useLocale, useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import type { SearchFeedVariant } from "./search-feed-content";
import type {
  SearchFeedParams,
  SearchFeedQueryOptions,
} from "./search-feed-query";
import type { SearchFilterValue } from "./search-filters";
import type { SearchSort } from "./search-params";

import { SearchFeedList } from "./search-feed-content";
import {
  activeSearchFilterCount,
  EMPTY_SEARCH_FILTERS,
  SearchFilters,
} from "./search-filters";
import { searchFacetsQueryOptions } from "./search-filters-query";
import {
  appliedSearchTerm,
  defaultSearchSort,
  parseSearchTypes,
  SEARCH_SORT_VALUES,
  SEARCH_TERM_DEBOUNCE_MS,
  searchDatePresetStart,
  searchDayRangeBounds,
  searchFeedParamsFor,
  sortForAppliedTerm,
} from "./search-params";

export type SearchFeedQueryFactory = (
  params: SearchFeedParams,
) => SearchFeedQueryOptions;

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
    target.isContentEditable);

const dateBoundsOf = (
  filters: SearchFilterValue,
  anchor: Date,
): { from?: string; to?: string } => {
  if (filters.range === "all") return {};
  if (filters.range === "custom") {
    return filters.customRange ? searchDayRangeBounds(filters.customRange) : {};
  }

  return { from: searchDatePresetStart(filters.range, anchor).toISOString() };
};

const SearchField = ({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) => {
  const t = useTranslations("core.search");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey)
        return;
      if (isTyping(event.target)) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <InputGroup className="h-14 rounded-2xl shadow-sm">
      <InputGroupAddon className="ps-4">
        <SearchIcon className="size-5" />
      </InputGroupAddon>
      <InputGroupInput
        aria-label={t("placeholder")}
        autoComplete="off"
        className="text-base md:text-lg"
        onChange={event => onChange(event.target.value)}
        placeholder={t("searchField")}
        ref={inputRef}
        type="search"
        value={value}
      />
      <InputGroupAddon align="inline-end" className="pe-4">
        {value ? (
          <button
            aria-label={t("clearSearch")}
            className="hover:bg-muted focus-visible:ring-ring flex size-8 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            type="button"
          >
            <XIcon className="size-4" />
          </button>
        ) : (
          <Kbd className="max-sm:hidden">/</Kbd>
        )}
      </InputGroupAddon>
    </InputGroup>
  );
};

export const SearchControlsContent = ({
  defaultParams,
  feedQuery,
  variant = "timeline",
}: {
  defaultParams: SearchFeedParams;
  feedQuery: SearchFeedQueryFactory;
  variant?: SearchFeedVariant;
}) => {
  const t = useTranslations("core.search");
  const locale = useLocale();
  const [term, setTerm] = React.useState(defaultParams.search ?? "");
  const [appliedTerm, setAppliedTerm] = React.useState(
    defaultParams.search ?? "",
  );
  const [filters, setFilters] = React.useState<SearchFilterValue>(() => ({
    ...EMPTY_SEARCH_FILTERS,
    types: parseSearchTypes(defaultParams.types),
  }));
  const [rangeAnchor, setRangeAnchor] = React.useState(() => new Date());
  const [sort, setSort] = React.useState<SearchSort>(
    () => defaultParams.sort ?? defaultSearchSort(defaultParams.search),
  );

  const applyTerm = useDebouncedCallback((value: string) => {
    const next = appliedSearchTerm(value);

    if (next === null) return;

    setAppliedTerm(next);
    if (next.length > 0) setSort(sortForAppliedTerm);
  }, SEARCH_TERM_DEBOUNCE_MS);

  const changeFilters = (next: SearchFilterValue) => {
    if (next.range !== filters.range) setRangeAnchor(new Date());
    setFilters(next);
  };

  const params = searchFeedParamsFor({
    authorIds: filters.authors.map(author => author.id),
    search: appliedTerm,
    sort,
    types: filters.types,
    ...dateBoundsOf(filters, rangeAnchor),
  });
  const query = useInfiniteQuery(feedQuery(params));
  const facets = useQuery(searchFacetsQueryOptions({ locale, params }));
  const total = query.data?.pages[0]?.pageInfo.totalCount;
  const active = activeSearchFilterCount(filters);

  const sidebar = (
    <SearchFilters
      onChange={changeFilters}
      typeCounts={facets.data?.types}
      value={filters}
    />
  );

  return (
    <div className="flex flex-col gap-8">
      <SearchField
        onChange={value => {
          setTerm(value);
          applyTerm(value);
        }}
        value={term}
      />

      <div className="grid gap-10 lg:grid-cols-4">
        <aside
          aria-label={t("filters.title")}
          className="self-start p-1 max-lg:hidden lg:sticky lg:top-24"
        >
          {sidebar}
        </aside>

        <div className="flex min-w-0 flex-col gap-6 lg:col-span-3">
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger render={<Button variant="outline" />}>
                <SlidersHorizontalIcon />
                {t("filters.title")}
                {active > 0 && (
                  <span className="bg-foreground text-background flex size-5 items-center justify-center rounded-full text-xs tabular-nums">
                    {active}
                  </span>
                )}
              </SheetTrigger>
              <SheetContent
                className="flex max-h-dvh flex-col gap-0"
                side="bottom"
              >
                <SheetHeader>
                  <SheetTitle>{t("filters.title")}</SheetTitle>
                </SheetHeader>
                <div className="min-h-0 overflow-y-auto px-4 pb-6">
                  {sidebar}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex items-center gap-3">
            <p aria-live="polite" className="text-muted-foreground text-sm">
              {total === undefined
                ? t("loading")
                : t("results", { count: total })}
            </p>
            <NativeSelect
              aria-label={t("sortBy")}
              className="ms-auto w-36"
              onChange={event => setSort(event.target.value as SearchSort)}
              size="sm"
              value={sort}
            >
              {SEARCH_SORT_VALUES.map(value => (
                <NativeSelectOption key={value} value={value}>
                  {t(`sort.${value}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <SearchFeedList query={query} variant={variant} />
        </div>
      </div>
    </div>
  );
};
