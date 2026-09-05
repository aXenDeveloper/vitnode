"use client";

import { ChevronsUpDownIcon } from "lucide-react";
import React from "react";
import { useDebouncedCallback } from "use-debounce";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** Anything this picker can offer: an identity and whatever renders it. */
export interface AsyncPickerOption {
  id: number;
}

export function AsyncPicker<TOption extends AsyncPickerOption>({
  className,
  disabled,
  emptyLabel,
  invalid,
  onSelect,
  renderOption,
  search,
  searchPlaceholder,
  selectedIds = [],
  trigger,
}: {
  className?: string;
  disabled?: boolean;
  emptyLabel?: string;
  invalid?: boolean;
  onSelect: (option: TOption) => void;
  renderOption: (option: TOption) => React.ReactNode;
  search: (value: string) => Promise<TOption[]>;
  searchPlaceholder?: string;
  selectedIds?: number[];
  trigger: React.ReactNode;
}) {
  const t = useTranslations("core.global");
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<TOption[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  const runSearch = React.useCallback(
    async (value: string) => {
      setIsSearching(true);
      try {
        setOptions(await search(value));
      } catch (error) {
        // A search that fails is an empty list plus a console line, never a
        // thrown error: this sits inside a form, and taking the page down
        // because a lookup timed out loses whatever else was typed.
        // eslint-disable-next-line no-console
        console.error(error);
        setOptions([]);
      } finally {
        setIsSearching(false);
      }
    },
    [search],
  );
  const debouncedSearch = useDebouncedCallback(runSearch, 400);
  const selected = new Set(selectedIds);

  return (
    <Popover
      onOpenChange={next => {
        setOpen(next);
        if (next) {
          setOptions([]);
          void runSearch("");
        }
      }}
      open={open}
    >
      <PopoverTrigger
        render={
          <Button
            aria-invalid={invalid}
            className={cn("w-full justify-start font-normal", className)}
            disabled={disabled}
            type="button"
            variant="outline"
          />
        }
      >
        {trigger}
        <ChevronsUpDownIcon className="ms-auto opacity-50" />
      </PopoverTrigger>

      <PopoverContent align="start" className="w-(--anchor-width) min-w-56 p-0">
        <Command shouldFilter={false}>
          <CommandInput
            onValueChange={debouncedSearch}
            placeholder={searchPlaceholder ?? t("search_placeholder")}
          />
          <CommandList>
            {isSearching && options.length === 0 ? (
              <div className="flex items-center justify-center py-6">
                <Spinner />
              </div>
            ) : (
              <>
                <CommandEmpty>
                  {emptyLabel ?? t("results_not_found")}
                </CommandEmpty>
                <CommandGroup>
                  {options.map(option => (
                    <CommandItem
                      data-checked={selected.has(option.id)}
                      key={option.id}
                      onSelect={() => {
                        onSelect(option);
                        setOpen(false);
                      }}
                      value={String(option.id)}
                    >
                      {renderOption(option)}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
