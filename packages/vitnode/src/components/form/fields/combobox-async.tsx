import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";
import { useDebouncedCallback } from "use-debounce";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FormControl, FormMessage } from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { Skeleton } from "../../ui/skeleton";
import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";

export const AutoFormComboboxAsync = ({
  label,
  field,
  description,
  placeholder,
  className,
  labelRight,
  id,
  otherProps: { isOptional },
  searchPlaceholder,
  fetchData,
  ...props
}: ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof Button>, "role" | "variant"> & {
    fetchData: (params: { search: string }) =>
      | Promise<
          {
            label: string;
            value: string;
          }[]
        >
      | {
          label: string;
          value: string;
        }[];
    id: string;
    placeholder?: string;
    searchPlaceholder?: string;
  }) => {
  const t = useTranslations("core.global");
  const [search, setSearch] = React.useState("");
  const { data, isLoading } = useQuery({
    queryKey: [id, { search }],
    queryFn: async () => {
      return await fetchData({ search });
    },
  });

  const handleChangeSearch = useDebouncedCallback((value: string) => {
    setSearch(value);
  }, 500);

  const renderCommandList = () => {
    if (isLoading) {
      return (
        <div className="space-y-2 p-2">
          <Skeleton className="h-6 rounded-sm" />
          <Skeleton className="h-6 rounded-sm" />
        </div>
      );
    }

    if ((data ?? []).length === 0) {
      return <CommandEmpty>{t("results_not_found")}</CommandEmpty>;
    }

    return (
      <CommandGroup>
        {(data ?? []).map(({ label, value }) => (
          <CommandItem
            key={value}
            onSelect={() => {
              field.onChange({
                label,
                value,
              });
            }}
            value={label}
          >
            {label}
            <Check
              className={cn(
                "ml-auto",
                value === field.value?.value ? "opacity-100" : "opacity-0",
              )}
            />
          </CommandItem>
        ))}
      </CommandGroup>
    );
  };

  return (
    <div className="flex flex-col">
      {label && (
        <AutoFormLabel isOptional={isOptional} labelRight={labelRight}>
          {label}
        </AutoFormLabel>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              aria-label="Combobox"
              className={cn(
                "w-50 justify-between bg-transparent",
                !field.value && "text-muted-foreground",
                className,
              )}
              role="combobox"
              variant="outline"
              {...props}
            >
              {field.value?.label ?? placeholder ?? t("select_option")}
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </FormControl>
        </PopoverTrigger>

        <PopoverContent className="w-50 p-0">
          <Command shouldFilter={false}>
            <CommandInput
              onChangeCapture={e => {
                handleChangeSearch(e.currentTarget.value);
              }}
              placeholder={searchPlaceholder ?? t("search_placeholder")}
            />

            <CommandList>{renderCommandList()}</CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </div>
  );
};
