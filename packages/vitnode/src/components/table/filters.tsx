import { PlusCircleIcon, Trash2 } from "lucide-react";
import React from "react";
import { useDebouncedCallback } from "use-debounce";
import { useTranslations } from "use-intl";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "../ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Separator } from "../ui/separator";
import { Spinner } from "../ui/spinner";
import { useDataTableUrl } from "./navigation";
import { readTableFilter, withTableFilter } from "./url-state";

/** One choice in a faceted filter. */
export interface FilterOption {
  /** Extra words the filter's search box matches, for static `options` only. */
  keywords?: string[];
  /** What the option shows in the filter list. */
  label: React.ReactNode;
  /** Written to the URL; matched by the search box for static `options`. */
  value: string;
}

/**
 * A faceted filter in a data table's toolbar. The selection lives in the URL
 * as `?{id}=a,b`, so the page's query reads it from there; changing it returns
 * the table to the first page.
 */
export interface FilterDataTable {
  /** The URL parameter the selected values are written to, comma-separated. */
  id: string;
  /** The button's text and the search box's placeholder. */
  label: string;
  /**
   * Loads options from the server instead of `options`: called with `""` when
   * the popover opens, then with the typed text after a 400 ms pause.
   */
  onSearch?: (search: string) => Promise<FilterOption[]>;
  /** A fixed list of choices, searched in the browser. Ignored with `onSearch`. */
  options?: FilterOption[];
  /**
   * Allows one value at a time and adds an "all" entry with this label that
   * clears it. Picking the selected value again also clears it.
   */
  single?: { allLabel: string };
}

/** The selection after toggling `value`; with `single`, at most that one value. */
export const nextFilterSelection = (
  selected: readonly string[],
  value: string,
  single = false,
): string[] => {
  if (single) return selected.includes(value) ? [] : [value];

  return selected.includes(value)
    ? selected.filter(item => item !== value)
    : [...selected, value];
};

function FilterItem({ filter }: { filter: FilterDataTable }) {
  const t = useTranslations("core.global");
  const { isPending, navigate, searchParams } = useDataTableUrl();

  const isAsync = Boolean(filter.onSearch);
  const [asyncOptions, setAsyncOptions] = React.useState<FilterOption[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  const selected = readTableFilter(searchParams, filter.id);
  const selectedSet = new Set(selected);
  const options = isAsync ? asyncOptions : (filter.options ?? []);

  const runSearch = React.useCallback(
    async (value: string) => {
      if (!filter.onSearch) return;
      setIsSearching(true);
      try {
        setAsyncOptions(await filter.onSearch(value));
      } finally {
        setIsSearching(false);
      }
    },
    [filter],
  );
  const debouncedSearch = useDebouncedCallback(runSearch, 400);

  const handleOpenChange = (open: boolean) => {
    if (open && isAsync) {
      setAsyncOptions([]);
      void runSearch("");
    }
  };

  const applySelection = (values: string[]) => {
    navigate(withTableFilter(searchParams, { id: filter.id, values }));
  };

  const toggle = (value: string) => {
    applySelection(
      nextFilterSelection(selected, value, Boolean(filter.single)),
    );
  };

  const selectedStaticOptions = isAsync
    ? []
    : (filter.options ?? []).filter(option => selectedSet.has(option.value));

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            className="border-dashed"
            disabled={isPending}
            variant="outline"
          />
        }
      >
        <PlusCircleIcon />
        {filter.label}
        {selected.length > 0 && (
          <>
            <Separator
              className="mx-0.5 data-[orientation=vertical]:h-4"
              orientation="vertical"
            />
            {isAsync || selectedStaticOptions.length > 2 ? (
              <Badge>
                {t.rich("selected_count", {
                  count: selected.length,
                  number: chunks => <>{chunks}</>,
                })}
              </Badge>
            ) : (
              selectedStaticOptions.map(option => (
                <Badge key={option.value}>{option.label}</Badge>
              ))
            )}
          </>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-0">
        <Command shouldFilter={!isAsync}>
          <CommandInput
            onValueChange={isAsync ? debouncedSearch : undefined}
            placeholder={filter.label}
          />
          <CommandList>
            {isSearching && options.length === 0 ? (
              <div className="flex items-center justify-center py-6">
                <Spinner />
              </div>
            ) : (
              <>
                <CommandEmpty>{t("results_not_found")}</CommandEmpty>
                <CommandGroup>
                  {filter.single ? (
                    <CommandItem
                      data-checked={selected.length === 0}
                      onSelect={() => applySelection([])}
                      value={filter.single.allLabel}
                    >
                      <span>{filter.single.allLabel}</span>
                    </CommandItem>
                  ) : null}
                  {options.map(option => {
                    const isSelected = selectedSet.has(option.value);

                    return (
                      <CommandItem
                        data-checked={filter.single ? isSelected : undefined}
                        key={option.value}
                        keywords={option.keywords}
                        onSelect={() => toggle(option.value)}
                        value={option.value}
                      >
                        {filter.single ? null : (
                          <Checkbox
                            aria-hidden
                            checked={isSelected}
                            className="pointer-events-none"
                            readOnly
                            tabIndex={-1}
                          />
                        )}
                        <span>{option.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
            {selected.length > 0 && !filter.single && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    className="justify-center text-center"
                    onSelect={() => applySelection([])}
                  >
                    <Trash2 /> {t("clear_filters")}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** One filter button per entry; `ContentDataTable` renders it from its `filters` prop. */
export function FiltersDataTable({ filters }: { filters: FilterDataTable[] }) {
  return (
    <>
      {filters.map(filter => (
        <FilterItem filter={filter} key={filter.id} />
      ))}
    </>
  );
}
