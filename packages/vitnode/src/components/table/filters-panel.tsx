import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import {
  CheckIcon,
  ChevronDownIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { FilterDataTable, FilterOption } from "./filters";

import { Button } from "../ui/button";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useDataTableUrl } from "./navigation";
import { readTableFilter, withTableFilter } from "./url-state";

const ALL = "__all__";

/** How many of `filters` have a value in the URL - for the toggle's badge. */
export const activeFiltersCount = (
  searchParams: URLSearchParams,
  filters: FilterDataTable[],
): number =>
  filters.filter(filter => readTableFilter(searchParams, filter.id).length)
    .length;

/**
 * The button that opens and closes a {@link FiltersPanelDataTable}, with the
 * number of filters that are on. Pass the panel's `id` as `controls`.
 */
export const FiltersPanelToggle = ({
  controls,
  filters,
  isOpen,
  onOpenChange,
}: {
  controls: string;
  filters: FilterDataTable[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const t = useTranslations("core.global.filters_panel");
  const { searchParams } = useDataTableUrl();
  const count = activeFiltersCount(searchParams, filters);

  return (
    <Button
      aria-controls={controls}
      aria-expanded={isOpen}
      aria-label={count ? t("toggle_active", { count }) : t("toggle")}
      className="shrink-0"
      onClick={() => {
        onOpenChange(!isOpen);
      }}
      variant={isOpen ? "secondary" : "outline"}
    >
      <SlidersHorizontalIcon aria-hidden />
      {t("toggle")}
      {count ? (
        <span
          aria-hidden
          className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full text-xs tabular-nums"
        >
          {count}
        </span>
      ) : null}
      <ChevronDownIcon
        aria-hidden
        className={cn(
          "transition-transform duration-200 ease-out motion-reduce:transition-none",
          isOpen && "rotate-180",
        )}
      />
    </Button>
  );
};

const useFieldOptions = (filter: FilterDataTable): FilterOption[] => {
  const { onSearch } = filter;
  const remote = useQuery({
    enabled: Boolean(onSearch),
    queryFn: async () => (onSearch ? await onSearch("") : []),
    queryKey: ["vitnode", "data-table", "filter-options", filter.id],
    retry: false,
  });

  return onSearch ? (remote.data ?? []) : (filter.options ?? []);
};

const FilterField = ({
  filter,
  onChange,
  value,
}: {
  filter: FilterDataTable;
  onChange: (values: string[]) => void;
  value: string[];
}) => {
  const t = useTranslations("core.global.filters_panel");
  const options = useFieldOptions(filter);
  const id = React.useId();
  const allLabel = filter.single?.allLabel ?? t("all");
  const items = [
    ...(filter.single ? [{ label: allLabel, value: ALL }] : []),
    ...options.map(option => ({ label: option.label, value: option.value })),
  ];

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{filter.label}</Label>
      {filter.single ? (
        <Select
          items={items}
          onValueChange={next => {
            onChange(typeof next === "string" && next !== ALL ? [next] : []);
          }}
          value={value[0] ?? ALL}
        >
          <SelectTrigger className="w-full" id={id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map(item => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Select
          items={items}
          multiple
          onValueChange={next => {
            onChange(
              Array.isArray(next)
                ? next.filter(
                    (item): item is string => typeof item === "string",
                  )
                : [],
            );
          }}
          value={value}
        >
          <SelectTrigger className="w-full" id={id}>
            <SelectValue placeholder={allLabel} />
          </SelectTrigger>
          <SelectContent>
            {items.map(item => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

const draftOf = (searchParams: URLSearchParams, filters: FilterDataTable[]) =>
  Object.fromEntries(
    filters.map(filter => [
      filter.id,
      readTableFilter(searchParams, filter.id),
    ]),
  );

/**
 * A data table's filters as an inline panel under the toolbar: one select per
 * filter in a responsive grid, applied together with "Show results" (back to
 * page one) and emptied with "Clear all". It opens and closes with a height
 * transition, kept off under reduced motion. Static `options` are listed as
 * they are; an `onSearch` filter lists what `onSearch("")` returns.
 *
 * `ContentDataTable` renders it for `filtersLayout="panel"`; a custom table
 * renders it under its own toolbar with a {@link FiltersPanelToggle}.
 */
export const FiltersPanelDataTable = ({
  filters,
  id,
  isOpen,
  onApplied,
}: {
  filters: FilterDataTable[];
  /** Matches the toggle's `controls`. */
  id: string;
  isOpen: boolean;
  /** Called after "Show results", e.g. to close the panel. */
  onApplied?: () => void;
}) => {
  const t = useTranslations("core.global.filters_panel");
  const { isPending, navigate, searchParams } = useDataTableUrl();
  const [draft, setDraft] = React.useState(() =>
    draftOf(searchParams, filters),
  );
  const [wasOpen, setWasOpen] = React.useState(isOpen);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setDraft(draftOf(searchParams, filters));
  }

  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] motion-reduce:transition-none",
        isOpen
          ? "grid-rows-[1fr] duration-250 ease-[cubic-bezier(0.32,0.72,0,1)]"
          : "grid-rows-[0fr] duration-180 ease-[cubic-bezier(0.4,0,1,1)]",
      )}
      id={id}
      inert={!isOpen}
    >
      <div className="min-h-0 overflow-hidden">
        <form
          aria-label={t("toggle")}
          className="bg-muted/40 mt-3 flex flex-col gap-4 rounded-lg p-4"
          onKeyDown={event => {
            if (event.key === "Escape") onApplied?.();
          }}
          onSubmit={event => {
            event.preventDefault();
            let next = searchParams.toString();
            for (const filter of filters) {
              next = withTableFilter(next, {
                id: filter.id,
                values: draft[filter.id] ?? [],
              });
            }
            navigate(next);
            onApplied?.();
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filters.map(filter => (
              <FilterField
                filter={filter}
                key={filter.id}
                onChange={values => {
                  setDraft(current => ({ ...current, [filter.id]: values }));
                }}
                value={draft[filter.id] ?? []}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              onClick={() => {
                setDraft(
                  Object.fromEntries(filters.map(filter => [filter.id, []])),
                );
              }}
              type="button"
              variant="ghost"
            >
              <RotateCcwIcon aria-hidden />
              {t("clear_all")}
            </Button>
            <Button isLoading={isPending} type="submit">
              <CheckIcon aria-hidden />
              {t("apply")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
