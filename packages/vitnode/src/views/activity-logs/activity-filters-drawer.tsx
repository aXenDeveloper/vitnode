import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { CheckIcon, FilterXIcon, SlidersHorizontalIcon } from "lucide-react";
import React from "react";
import { useDebouncedCallback } from "use-debounce";
import { useTranslations } from "use-intl";

import type { FilterDataTable } from "@/components/table/filters";

import { useDataTableUrl } from "@/components/table/navigation";
import { readTableFilter, withTableFilter } from "@/components/table/url-state";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const COLLAPSED_OPTIONS = 8;

/** A selectable chip in the filters drawer; `aria-pressed` carries its state. */
export const OptionChip = ({
  children,
  isSelected,
  onSelect,
}: {
  children: React.ReactNode;
  isSelected: boolean;
  onSelect: () => void;
}) => (
  <button
    aria-pressed={isSelected}
    className={cn(
      "focus-visible:ring-ring/50 flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium outline-none select-none focus-visible:ring-3",
      "transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-97 motion-reduce:transition-none",
      isSelected
        ? "border-primary bg-primary text-primary-foreground"
        : "bg-card text-foreground border-foreground/15 hover:bg-muted",
    )}
    onClick={onSelect}
    type="button"
  >
    {isSelected ? <CheckIcon aria-hidden className="size-4" /> : null}
    {children}
  </button>
);

const FilterSection = ({ filter }: { filter: FilterDataTable }) => {
  const t = useTranslations("core.activity_logs.filters");
  const { navigate, searchParams } = useDataTableUrl();
  const selected = readTableFilter(searchParams, filter.id);
  const headingId = React.useId();
  const [term, setTerm] = React.useState("");
  const setTermLater = useDebouncedCallback(setTerm, 400);
  const { onSearch } = filter;
  const asyncOptions = useQuery({
    enabled: Boolean(onSearch),
    placeholderData: keepPreviousData,
    queryFn: async () => (onSearch ? await onSearch(term) : []),
    queryKey: ["vitnode", "activity-logs", "filter-options", filter.id, term],
    retry: false,
  });
  const isSearching = asyncOptions.isFetching;

  const staticOptions = filter.options ?? [];
  const isLong = !onSearch && staticOptions.length > COLLAPSED_OPTIONS;
  const [localTerm, setLocalTerm] = React.useState("");
  const [isExpanded, setIsExpanded] = React.useState(false);
  const matching = localTerm
    ? staticOptions.filter(option =>
        [
          typeof option.label === "string" ? option.label : "",
          ...(option.keywords ?? []),
        ].some(text => text.toLowerCase().includes(localTerm.toLowerCase())),
      )
    : staticOptions;
  const visible =
    isLong && !isExpanded && !localTerm
      ? matching.filter(
          (option, index) =>
            index < COLLAPSED_OPTIONS || selected.includes(option.value),
        )
      : matching;
  const options = onSearch ? (asyncOptions.data ?? []) : visible;
  const select = (values: string[]) => {
    navigate(withTableFilter(searchParams, { id: filter.id, values }));
  };
  const toggle = (value: string) => {
    if (filter.single) {
      select(selected.includes(value) ? [] : [value]);
    } else {
      select(
        selected.includes(value)
          ? selected.filter(item => item !== value)
          : [...selected, value],
      );
    }
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 className="text-sm font-medium" id={headingId}>
        {filter.label}
      </h3>
      {isLong ? (
        <Input
          aria-label={filter.label}
          className="h-10"
          enterKeyHint="search"
          onChange={event => {
            setLocalTerm(event.target.value.trim());
          }}
          placeholder={t("search_in", { filter: filter.label })}
          type="search"
        />
      ) : null}
      {filter.onSearch ? (
        <div className="relative">
          <Input
            aria-label={filter.label}
            className="h-10 pe-9"
            enterKeyHint="search"
            onChange={event => {
              setTermLater(event.target.value);
            }}
            placeholder={t("search_in", { filter: filter.label })}
            type="search"
          />
          {isSearching ? (
            <Spinner className="absolute end-3 top-1/2 -translate-y-1/2" />
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {filter.single ? (
          <OptionChip
            isSelected={selected.length === 0}
            onSelect={() => {
              select([]);
            }}
          >
            {filter.single.allLabel}
          </OptionChip>
        ) : null}
        {options.map(option => (
          <OptionChip
            isSelected={selected.includes(option.value)}
            key={option.value}
            onSelect={() => {
              toggle(option.value);
            }}
          >
            {option.label}
          </OptionChip>
        ))}
        {isLong && !isExpanded && !localTerm ? (
          <button
            className="text-primary focus-visible:ring-ring/50 min-h-10 rounded-full px-3 text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3"
            onClick={() => {
              setIsExpanded(true);
            }}
            type="button"
          >
            {t("show_all", { count: staticOptions.length })}
          </button>
        ) : null}
        {options.length === 0 &&
        (filter.onSearch ? !isSearching : localTerm) ? (
          <p className="text-muted-foreground py-2 text-sm">
            {t("no_options")}
          </p>
        ) : null}
      </div>
    </section>
  );
};

/**
 * The toolbar filters of a data table in a bottom drawer, for a phone: one
 * button beside the search that says how many filters are on, and a drawer
 * with every filter's options as chips. A tap applies right away, like the
 * filter popovers on a wider screen; "Show results" closes the drawer.
 */
export const ActivityFiltersDrawer = ({
  extra,
  filters,
  resultCount,
}: {
  /**
   * A filter that is not a faceted one, such as the date range: its section
   * (shown first) and the URL keys it writes, for the active count and "Clear all".
   */
  extra?: { keys: string[]; section: React.ReactNode };
  filters: FilterDataTable[];
  /** Entries matching the current filters, for the close button; absent while loading. */
  resultCount?: number;
}) => {
  const t = useTranslations("core.activity_logs.filters");
  const { navigate, searchParams } = useDataTableUrl();
  const [isOpen, setIsOpen] = React.useState(false);
  const isExtraActive = (extra?.keys ?? []).some(key => searchParams.has(key));
  const activeCount =
    filters.filter(
      filter => readTableFilter(searchParams, filter.id).length > 0,
    ).length + (isExtraActive ? 1 : 0);

  const clearAll = () => {
    let next: string = searchParams.toString();
    for (const filter of filters) {
      next = withTableFilter(next, { id: filter.id, values: [] });
    }
    for (const key of extra?.keys ?? []) {
      next = withTableFilter(next, { id: key, values: [] });
    }
    navigate(next);
  };

  return (
    <Drawer onOpenChange={setIsOpen} open={isOpen}>
      <DrawerTrigger
        render={
          <Button
            aria-label={
              activeCount ? t("open_active", { count: activeCount }) : t("open")
            }
            className="shrink-0"
            variant="outline"
          />
        }
      >
        <SlidersHorizontalIcon aria-hidden />
        {t("open")}
        {activeCount ? (
          <span
            aria-hidden
            className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full text-xs tabular-nums"
          >
            {activeCount}
          </span>
        ) : null}
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="flex-row items-center justify-between gap-2 border-b pb-3 text-start">
          <DrawerTitle className="text-base font-semibold">
            {t("open")}
          </DrawerTitle>
          {activeCount ? (
            <Button onClick={clearAll} size="sm" variant="ghost">
              <FilterXIcon aria-hidden />
              {t("clear_all")}
            </Button>
          ) : null}
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-4 py-5">
          {extra?.section}
          {filters.map(filter => (
            <FilterSection filter={filter} key={filter.id} />
          ))}
        </div>
        <DrawerFooter className="border-t pb-[max(env(safe-area-inset-bottom),1rem)]">
          <DrawerClose render={<Button className="h-11 w-full" />}>
            <CheckIcon aria-hidden />
            {resultCount === undefined
              ? t("show_results")
              : t("show_count", { count: resultCount })}
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
