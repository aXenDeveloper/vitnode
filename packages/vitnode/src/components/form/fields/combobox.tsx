import type React from "react";

import { Check, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FormControl, FormItem, FormMessage } from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";

export const AutoFormCombobox = ({
  label,
  field,
  description,
  placeholder,
  className,
  otherProps: { enum: enumValues = [], isOptional },
  labels = [],
  labelRight,
  searchPlaceholder,
  ...props
}: ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof Button>, "role" | "variant"> & {
    labels?: { label: string; value: string }[];
    placeholder?: string;
    searchPlaceholder?: string;
  }) => {
  const t = useTranslations("core.global");

  const values: { label: string; value: string }[] = enumValues.map(value => {
    const label = labels.find(l => l.value === value)?.label;

    return {
      value,
      label: label ?? value,
    };
  });

  return (
    <FormItem className="flex flex-col">
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
                "w-[200px] justify-between",
                !field.value && "text-muted-foreground",
                className,
              )}
              role="combobox"
              variant="outline"
              {...props}
            >
              {field.value
                ? values.find(({ value }) => value === field.value)?.label
                : (placeholder ?? t("select_option"))}
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </FormControl>
        </PopoverTrigger>

        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput
              placeholder={searchPlaceholder ?? t("search_placeholder")}
            />
            <CommandList>
              <CommandEmpty>{t("results_not_found")}</CommandEmpty>
              <CommandGroup>
                {values.map(({ label, value }) => (
                  <CommandItem
                    key={value}
                    onSelect={() => {
                      field.onChange(value);
                    }}
                    value={label}
                  >
                    {label}
                    <Check
                      className={cn(
                        "ml-auto",
                        value === field.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </FormItem>
  );
};
