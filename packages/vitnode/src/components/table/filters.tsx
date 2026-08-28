"use client";

import { CheckIcon, PlusCircleIcon, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";
import { useDebouncedCallback } from "use-debounce";

import { cn } from "@/lib/utils";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
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

export interface FilterOption {
  keywords?: string[];
  label: React.ReactNode;
  value: string;
}

export interface FilterDataTable {
  id: string;
  label: string;
  onSearch?: (search: string) => Promise<FilterOption[]>;
  options?: FilterOption[];
}

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
    const next = new Set(selectedSet);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    applySelection([...next]);
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
            <Separator className="mx-0.5 h-4" orientation="vertical" />
            {isAsync || selectedStaticOptions.length > 2 ? (
              <Badge>{t("selected_count", { count: selected.length })}</Badge>
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
                  {options.map(option => {
                    const isSelected = selectedSet.has(option.value);

                    return (
                      <CommandItem
                        key={option.value}
                        keywords={option.keywords}
                        onSelect={() => toggle(option.value)}
                        value={option.value}
                      >
                        <div
                          className={cn(
                            "border-primary flex size-4 items-center justify-center rounded-sm border",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible",
                          )}
                        >
                          <CheckIcon className="size-3.5" />
                        </div>
                        <span>{option.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
            {selected.length > 0 && (
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

export function FiltersDataTable({ filters }: { filters: FilterDataTable[] }) {
  return (
    <>
      {filters.map(filter => (
        <FilterItem filter={filter} key={filter.id} />
      ))}
    </>
  );
}
