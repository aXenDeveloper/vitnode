import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import {
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import React from "react";
import { useFormatter, useNow, useTranslations } from "use-intl";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import type { SearchDateRange, SearchDayRange } from "./search-params";
import type { SearchResultAuthor } from "./types";

import { getSearchTypeRenderer, searchTypeKeys } from "./registry";
import { searchAuthorsQueryOptions } from "./search-filters-query";
import { SEARCH_DATE_PRESETS, SEARCH_TERM_DEBOUNCE_MS } from "./search-params";

export interface SearchFilterValue {
  authors: SearchResultAuthor[];
  customRange: null | SearchDayRange;
  range: SearchDateRange;
  types: string[];
}

export const EMPTY_SEARCH_FILTERS: SearchFilterValue = {
  authors: [],
  customRange: null,
  range: "all",
  types: [],
};

export const activeSearchFilterCount = ({
  authors,
  range,
  types,
}: SearchFilterValue): number =>
  types.length + authors.length + (range === "all" ? 0 : 1);

const ROW =
  "hover:bg-muted flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors";

const middayOf = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);

const isTouchDevice = () =>
  typeof window !== "undefined" && "ontouchstart" in window;

const LinkButton = ({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) => (
  <button
    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
    onClick={onClick}
    type="button"
  >
    {children}
  </button>
);

const Group = ({
  children,
  label,
  onReset,
}: {
  children: React.ReactNode;
  label: string;
  onReset?: () => void;
}) => {
  const t = useTranslations("core.search.filters");

  return (
    <fieldset className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center justify-between gap-2 px-2 pb-1">
        <legend className="text-foreground text-sm font-semibold">
          {label}
        </legend>
        {onReset && <LinkButton onClick={onReset}>{t("reset")}</LinkButton>}
      </div>
      {children}
    </fieldset>
  );
};

const TypeGroup = ({
  counts,
  onChange,
  types,
}: {
  counts?: null | Record<string, number>;
  onChange: (types: string[]) => void;
  types: string[];
}) => {
  const t = useTranslations("core.search");

  return (
    <Group
      label={t("filters.content")}
      onReset={types.length > 0 ? () => onChange([]) : undefined}
    >
      {searchTypeKeys.map(key => {
        const renderer = getSearchTypeRenderer(key);
        const Icon = renderer.icon;
        const checked = types.includes(key);

        return (
          <label className={ROW} key={key}>
            <Checkbox
              checked={checked}
              onCheckedChange={() =>
                onChange(
                  checked
                    ? types.filter(type => type !== key)
                    : [...types, key],
                )
              }
            />
            <Icon aria-hidden className="text-muted-foreground size-4" />
            <span className="text-foreground">{t(renderer.labelKey)}</span>
            {counts && (
              <span className="text-muted-foreground ms-auto text-xs tabular-nums">
                {counts[key] ?? 0}
              </span>
            )}
          </label>
        );
      })}
    </Group>
  );
};

const useDayRangeLabel = (range: null | SearchDayRange) => {
  const format = useFormatter();

  return range
    ? format.dateTimeRange(range.from, range.to, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
};

const CustomRangeField = ({
  autoOpen,
  onChange,
  range,
}: {
  autoOpen: boolean;
  onChange: (range: SearchDayRange) => void;
  range: SearchDayRange;
}) => {
  const t = useTranslations("core.search.filters");
  const [open, setOpen] = React.useState(autoOpen);
  const label = useDayRangeLabel(range);
  const today = useNow();

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        aria-label={t("customRange", { range: label })}
        render={
          <button
            className="bg-card border-input hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 flex h-10 w-full items-center gap-2 rounded-lg border px-3 text-start text-sm shadow-xs transition-colors outline-none focus-visible:ring-3"
            type="button"
          />
        }
      >
        <CalendarIcon
          aria-hidden
          className="text-muted-foreground size-4 shrink-0"
        />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronDownIcon
          aria-hidden
          className="text-muted-foreground size-4 shrink-0"
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-auto flex-col gap-0 p-0">
        <Calendar
          defaultMonth={range.to}
          disabled={{ after: today }}
          endMonth={today}
          mode="range"
          numberOfMonths={1}
          onSelect={selected => {
            if (!selected?.from) return;
            onChange({
              from: middayOf(selected.from),
              to: middayOf(selected.to ?? selected.from),
            });
          }}
          selected={range}
        />
        <div className="flex items-center justify-between gap-2 border-t p-2">
          <span className="text-muted-foreground px-1 text-xs">
            {t("pickDates")}
          </span>
          <Button onClick={() => setOpen(false)} size="sm">
            {t("done")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const defaultCustomRange = (): SearchDayRange => {
  const today = new Date();

  return {
    from: new Date(today.getFullYear(), today.getMonth(), 1, 12),
    to: middayOf(today),
  };
};

const DateGroup = ({
  customRange,
  onChange,
  range,
}: {
  customRange: null | SearchDayRange;
  onChange: (next: Pick<SearchFilterValue, "customRange" | "range">) => void;
  range: SearchDateRange;
}) => {
  const t = useTranslations("core.search");
  const [openCalendar, setOpenCalendar] = React.useState(false);
  const options: SearchDateRange[] = ["all", ...SEARCH_DATE_PRESETS, "custom"];

  return (
    <Group
      label={t("filters.date")}
      onReset={
        range === "all"
          ? undefined
          : () => onChange({ customRange, range: "all" })
      }
    >
      <RadioGroup
        className="gap-0"
        onValueChange={value => {
          const next = value as SearchDateRange;
          setOpenCalendar(next === "custom");
          onChange({
            customRange:
              next === "custom"
                ? (customRange ?? defaultCustomRange())
                : customRange,
            range: next,
          });
        }}
        value={range}
      >
        {options.map(option => (
          <label className={ROW} key={option}>
            <RadioGroupItem value={option} />
            <span
              className={cn(
                "text-foreground",
                range === option && "font-medium",
              )}
            >
              {t(`range.${option}`)}
            </span>
          </label>
        ))}
      </RadioGroup>
      {range === "custom" && customRange && (
        <div className="px-2 pt-1">
          <CustomRangeField
            autoOpen={openCalendar}
            onChange={next => onChange({ customRange: next, range: "custom" })}
            range={customRange}
          />
        </div>
      )}
    </Group>
  );
};

const useDebouncedValue = (value: string, delay: number) => {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
};

const AuthorOptions = ({
  onToggle,
  selected,
  term,
}: {
  onToggle: (author: SearchResultAuthor) => void;
  selected: SearchResultAuthor[];
  term: string;
}) => {
  const t = useTranslations("core.search.filters");
  const debounced = useDebouncedValue(term.trim(), SEARCH_TERM_DEBOUNCE_MS / 2);
  const { data, isLoading } = useQuery(
    searchAuthorsQueryOptions({ term: debounced }),
  );
  const authors = data?.authors ?? [];

  if (isLoading) {
    return (
      <p className="text-muted-foreground px-2 py-3 text-center text-sm">
        {t("loadingAuthors")}
      </p>
    );
  }

  if (authors.length === 0) {
    return (
      <p className="text-muted-foreground px-2 py-3 text-center text-sm">
        {t("noAuthors", { term })}
      </p>
    );
  }

  return (
    <>
      {authors.map(author => {
        const pressed = selected.some(entry => entry.id === author.id);

        return (
          <button
            aria-pressed={pressed}
            className="hover:bg-muted focus-visible:bg-muted flex min-h-9 items-center gap-2.5 rounded-md px-2 py-1 text-start text-sm outline-none"
            key={author.id}
            onClick={() => onToggle(author)}
            type="button"
          >
            <Avatar alt="" size={24} user={author} />
            <span className="min-w-0 flex-1 truncate">{author.name}</span>
            <CheckIcon
              aria-hidden
              className={cn("text-primary size-4", !pressed && "invisible")}
            />
          </button>
        );
      })}
    </>
  );
};

const AuthorGroup = ({
  authors,
  onChange,
}: {
  authors: SearchResultAuthor[];
  onChange: (authors: SearchResultAuthor[]) => void;
}) => {
  const t = useTranslations("core.search.filters");
  const [open, setOpen] = React.useState(false);
  const [term, setTerm] = React.useState("");

  const toggle = (author: SearchResultAuthor) =>
    onChange(
      authors.some(entry => entry.id === author.id)
        ? authors.filter(entry => entry.id !== author.id)
        : [...authors, author],
    );

  return (
    <Group
      label={t("authors")}
      onReset={authors.length > 0 ? () => onChange([]) : undefined}
    >
      <div className="px-2">
        <div className="bg-card border-input flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border p-1.5 shadow-xs">
          {authors.map(author => (
            <span
              className="bg-muted text-foreground flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-full px-0.5 text-sm"
              key={author.id}
            >
              <Avatar alt="" size={24} user={author} />
              <span className="min-w-0 truncate">{author.name}</span>
              <button
                aria-label={t("removeAuthor", { name: author.name })}
                className="hover:bg-background focus-visible:ring-ring flex size-6 shrink-0 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
                onClick={() => toggle(author)}
                type="button"
              >
                <XIcon aria-hidden className="size-3.5" />
              </button>
            </span>
          ))}
          <Popover
            onOpenChange={next => {
              setOpen(next);
              if (!next) setTerm("");
            }}
            open={open}
          >
            <PopoverTrigger
              render={
                <button
                  className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring flex h-7 items-center gap-1 rounded-full px-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                  type="button"
                />
              }
            >
              <PlusIcon aria-hidden className="size-4" />
              {authors.length > 0 ? t("addAuthor") : t("anyAuthor")}
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="flex w-72 flex-col gap-0 p-0"
            >
              <label className="relative flex items-center border-b">
                <span className="sr-only">{t("findAuthor")}</span>
                <SearchIcon
                  aria-hidden
                  className="text-muted-foreground pointer-events-none absolute start-3 size-4"
                />
                <input
                  autoComplete="off"
                  autoFocus={!isTouchDevice()}
                  className="h-11 w-full bg-transparent ps-9 pe-3 text-base outline-none"
                  data-1p-ignore
                  onChange={e => setTerm(e.target.value)}
                  placeholder={t("findAuthor")}
                  spellCheck={false}
                  type="search"
                  value={term}
                />
              </label>
              <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto p-1">
                {open && (
                  <AuthorOptions
                    onToggle={toggle}
                    selected={authors}
                    term={term}
                  />
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </Group>
  );
};

export const SearchFilters = ({
  onChange,
  showTitle = true,
  typeCounts,
  value,
}: {
  onChange: (value: SearchFilterValue) => void;
  showTitle?: boolean;
  typeCounts?: null | Record<string, number>;
  value: SearchFilterValue;
}) => {
  const t = useTranslations("core.search.filters");
  const active = activeSearchFilterCount(value);

  return (
    <div className="flex flex-col gap-6">
      {(showTitle || active > 0) && (
        <div className="flex h-8 items-center gap-2 px-2">
          {showTitle && (
            <h2 className="text-foreground text-base font-semibold">
              {t("title")}
            </h2>
          )}
          {active > 0 && (
            <>
              <span
                aria-label={t("active", { count: active })}
                className="bg-foreground text-background flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium tabular-nums"
                role="status"
              >
                {active}
              </span>
              <span className="ms-auto">
                <LinkButton onClick={() => onChange(EMPTY_SEARCH_FILTERS)}>
                  {t("clearAll")}
                </LinkButton>
              </span>
            </>
          )}
        </div>
      )}
      <TypeGroup
        counts={typeCounts}
        onChange={types => onChange({ ...value, types })}
        types={value.types}
      />
      <DateGroup
        customRange={value.customRange}
        onChange={next => onChange({ ...value, ...next })}
        range={value.range}
      />
      <AuthorGroup
        authors={value.authors}
        onChange={authors => onChange({ ...value, authors })}
      />
    </div>
  );
};
