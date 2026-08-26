import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import React from "react";
import { useDebouncedCallback } from "use-debounce";

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";

export interface ComboboxAsyncItem {
  label: string;
  value: string;
}
type ComboboxFetchData = (params: {
  search: string;
}) => ComboboxAsyncItem[] | Promise<ComboboxAsyncItem[]>;

type AutoFormComboboxProps = ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof Combobox>, "items" | "value"> & {
    className?: string;
    labels?: { label: string; value: string }[];
    placeholder?: string;
    queryKey?: readonly unknown[];
    renderChip?: (item: ComboboxAsyncItem) => React.ReactNode;
    renderItem?: (item: ComboboxAsyncItem) => React.ReactNode;
    showClear?: boolean;
  } & (
    | {
        fetchData: ComboboxFetchData;
        id: string;
        searchPlaceholder?: string;
      }
    | {
        fetchData?: undefined;
        id?: string;
        searchPlaceholder?: string;
      }
  );

export const AutoFormCombobox = ({
  label,
  field,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  itemParams,
  // Only the language-aware inputs implement this - dropped here so it never
  // lands on the DOM element the rest props spread into.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  multiLang,
  description,
  placeholder,
  otherProps,
  labels = [],
  labelRight,
  onValueChange,
  onInputValueChange,
  disabled,
  multiple = false,
  className,
  showClear,
  fetchData,
  id,
  queryKey,
  searchPlaceholder,
  filter,
  renderChip,
  renderItem,
  ...props
}: AutoFormComboboxProps) => {
  const t = useTranslations("core.global");
  const anchor = useComboboxAnchor();
  const isAsync = typeof fetchData === "function";
  const isMultiple = multiple;
  const [search, setSearch] = React.useState("");
  const { data, isLoading } = useQuery({
    queryKey: [...(queryKey ?? [id ?? "combobox"]), { search }],
    queryFn: async () => {
      if (!fetchData) return [];

      return await fetchData({ search });
    },
    enabled: isAsync,
  });

  const handleChangeSearch = useDebouncedCallback((value: string) => {
    setSearch(value);
  }, 500);

  const items = isAsync ? (data ?? []) : (otherProps?.enum ?? []);
  const inputPlaceholder = isAsync
    ? (searchPlaceholder ?? placeholder ?? t("select_option"))
    : (placeholder ?? t("select_option"));
  const getComboboxValue = () => {
    if (isMultiple) {
      return field.value ?? [];
    }

    return field.value ?? null;
  };
  const comboboxValue = getComboboxValue();
  const comboboxDefaultValue = comboboxValue;
  const comboboxFilter = isAsync ? null : filter;
  const comboboxItemEqual: React.ComponentProps<
    typeof Combobox
  >["isItemEqualToValue"] = isAsync
    ? (itemValue, value) => {
        const item = itemValue as ComboboxAsyncItem | null | undefined;
        const currentValue = value as ComboboxAsyncItem | null | undefined;

        return item?.value === currentValue?.value;
      }
    : undefined;
  const onComboboxInputValueChange = (
    value: string,
    event: Parameters<
      NonNullable<React.ComponentProps<typeof Combobox>["onInputValueChange"]>
    >[1],
  ) => {
    if (isAsync) {
      handleChangeSearch(value);
    }
    onInputValueChange?.(value, event);
  };
  const onComboboxValueChange = (
    value: Parameters<
      NonNullable<React.ComponentProps<typeof Combobox>["onValueChange"]>
    >[0],
    event: Parameters<
      NonNullable<React.ComponentProps<typeof Combobox>["onValueChange"]>
    >[1],
  ) => {
    field.onChange(value);
    onValueChange?.(value, event);
  };

  const renderItems = () => {
    if (isAsync) {
      return (
        <ComboboxList>
          {(item: ComboboxAsyncItem) => (
            <ComboboxItem key={item.value} value={item}>
              {renderItem ? renderItem(item) : item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      );
    }

    return (
      <ComboboxList>
        {(item: string) => (
          <ComboboxItem key={item} value={item}>
            {labels.find(l => l.value === item)?.label ?? item}
          </ComboboxItem>
        )}
      </ComboboxList>
    );
  };

  const renderContent = () => {
    if (isAsync && isLoading) {
      return (
        <div className="space-y-2 p-2">
          <Skeleton className="h-6 rounded-sm" />
          <Skeleton className="h-6 rounded-sm" />
        </div>
      );
    }

    return (
      <>
        <ComboboxEmpty>{t("results_not_found")}</ComboboxEmpty>
        {renderItems()}
      </>
    );
  };

  return (
    <>
      {!!label && (
        <AutoFormLabel
          isOptional={otherProps.isOptional}
          labelRight={labelRight}
        >
          {label}
        </AutoFormLabel>
      )}

      <Combobox
        autoHighlight
        defaultValue={comboboxDefaultValue}
        disabled={disabled}
        filter={comboboxFilter}
        isItemEqualToValue={comboboxItemEqual}
        items={items}
        multiple={isMultiple}
        onInputValueChange={onComboboxInputValueChange}
        onValueChange={onComboboxValueChange}
        value={comboboxValue}
        {...props}
      >
        {isMultiple ? (
          <>
            <ComboboxChips className={className} ref={anchor}>
              <ComboboxValue>
                {(values: (ComboboxAsyncItem | string)[]) => (
                  <>
                    {values.map(value => {
                      const item =
                        typeof value === "string"
                          ? {
                              label:
                                labels.find(l => l.value === value)?.label ??
                                value,
                              value,
                            }
                          : value;

                      return (
                        <ComboboxChip key={item.value}>
                          {renderChip ? renderChip(item) : item.label}
                        </ComboboxChip>
                      );
                    })}
                    <ComboboxChipsInput
                      aria-invalid={otherProps?.["aria-invalid"] ?? false}
                      disabled={disabled}
                      placeholder={
                        values.length === 0 ? inputPlaceholder : undefined
                      }
                    />
                  </>
                )}
              </ComboboxValue>
            </ComboboxChips>
            <ComboboxContent anchor={anchor}>{renderContent()}</ComboboxContent>
          </>
        ) : (
          <>
            <ComboboxInput
              aria-invalid={otherProps?.["aria-invalid"] ?? false}
              className={className}
              disabled={disabled}
              placeholder={inputPlaceholder}
              showClear={showClear}
            />
            <ComboboxContent anchor={anchor}>{renderContent()}</ComboboxContent>
          </>
        )}
      </Combobox>

      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
