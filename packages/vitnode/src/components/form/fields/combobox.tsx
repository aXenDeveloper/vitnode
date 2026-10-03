import { useQuery } from "@tanstack/react-query";
import React from "react";
import { useDebouncedCallback } from "use-debounce";
import { useTranslations } from "use-intl";

import {
  Combobox,
  ComboboxChip,
  ComboboxChipList,
  ComboboxChipOverflow,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";

import type { ItemAutoFormComponentProps } from "../auto-form";
import type { ComboboxItemGroup, ComboboxOption } from "./combobox-groups";

import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";
import { groupComboboxItems } from "./combobox-groups";

export interface ComboboxAsyncItem {
  label: string;
  value: string;
}
type ComboboxFetchData = (params: {
  search: string;
}) => ComboboxAsyncItem[] | Promise<ComboboxAsyncItem[]>;

export const COMBOBOX_INERT_QUERY_KEY = "combobox:no-fetcher";

type AutoFormComboboxProps = ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof Combobox>, "items" | "value"> & {
    className?: string;
    labels?: ComboboxOption[];
    maxVisibleChips?: number;
    placeholder?: string;
    renderChip?: (item: ComboboxAsyncItem) => React.ReactNode;
    renderItem?: (item: ComboboxAsyncItem) => React.ReactNode;
    showClear?: boolean;
  } & (
    | {
        fetchData: ComboboxFetchData;
        id: string;
        queryKey: readonly unknown[];
        searchPlaceholder?: string;
      }
    | {
        fetchData?: undefined;
        id?: string;
        queryKey?: undefined;
        searchPlaceholder?: string;
      }
  );

type ComboboxRootProps = React.ComponentProps<typeof Combobox>;
type ComboboxOnValueChange = NonNullable<ComboboxRootProps["onValueChange"]>;
type ComboboxOnInputValueChange = NonNullable<
  ComboboxRootProps["onInputValueChange"]
>;

const isSameAsyncItem: ComboboxRootProps["isItemEqualToValue"] = (
  itemValue,
  value,
) => {
  const item = itemValue as ComboboxAsyncItem | null | undefined;
  const currentValue = value as ComboboxAsyncItem | null | undefined;

  return item?.value === currentValue?.value;
};

const useComboboxAsyncItems = ({
  fetchData,
  id,
  queryKey,
}: {
  fetchData?: ComboboxFetchData;
  id?: string;
  queryKey?: readonly unknown[];
}) => {
  const [search, setSearch] = React.useState("");
  const { data, isLoading } = useQuery({
    // `queryKey` is required wherever `fetchData` is - see the props type - so
    // the fallback below belongs to the synchronous case alone, whose query is
    // disabled and never holds an answer.
    queryKey: queryKey
      ? [...queryKey, { search }]
      : [COMBOBOX_INERT_QUERY_KEY, id ?? null],
    queryFn: async () => {
      if (!fetchData) return [];

      return await fetchData({ search });
    },
    enabled: typeof fetchData === "function",

    retry: false,
  });

  const handleChangeSearch = useDebouncedCallback((value: string) => {
    setSearch(value);
  }, 500);

  return { data, handleChangeSearch, isLoading };
};

const useComboboxSource = ({
  fetchData,
  filter,
  id,
  enumItems,
  labels,
  onInputValueChange,
  placeholder,
  queryKey,
  searchPlaceholder,
}: {
  enumItems: string[];
  fetchData?: ComboboxFetchData;
  filter: ComboboxRootProps["filter"];
  id?: string;
  labels: ComboboxOption[];
  onInputValueChange?: ComboboxOnInputValueChange;
  placeholder?: string;
  queryKey?: readonly unknown[];
  searchPlaceholder?: string;
}) => {
  const t = useTranslations("core.global");
  const isAsync = typeof fetchData === "function";
  const { data, handleChangeSearch, isLoading } = useComboboxAsyncItems({
    fetchData,
    id,
    queryKey,
  });
  const staticItemLabel = (item: string) =>
    labels.find(l => l.value === item)?.label ?? item;
  const fallbackPlaceholder = placeholder ?? t("select_option");
  const onComboboxInputValueChange: ComboboxOnInputValueChange = (
    value,
    event,
  ) => {
    if (isAsync) {
      handleChangeSearch(value);
    }
    onInputValueChange?.(value, event);
  };

  if (isAsync) {
    return {
      filter: null,
      groupedItems: null,
      inputPlaceholder: searchPlaceholder ?? fallbackPlaceholder,
      isAsync,
      isItemEqualToValue: isSameAsyncItem,
      isLoading,
      items: data ?? [],
      itemToStringLabel: undefined,
      onInputValueChange: onComboboxInputValueChange,
      staticItemLabel,
    };
  }

  return {
    filter,
    groupedItems: groupComboboxItems(enumItems, labels),
    inputPlaceholder: fallbackPlaceholder,
    isAsync,
    isItemEqualToValue: undefined,
    isLoading,
    items: enumItems,
    itemToStringLabel: staticItemLabel,
    onInputValueChange: onComboboxInputValueChange,
    staticItemLabel,
  };
};

const ComboboxItemsList = ({
  groupedItems,
  isAsync,
  renderItem,
  staticItemLabel,
}: {
  groupedItems: ComboboxItemGroup[] | null;
  isAsync: boolean;
  renderItem?: (item: ComboboxAsyncItem) => React.ReactNode;
  staticItemLabel: (item: string) => string;
}) => {
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

  const renderStaticItem = (item: string) => (
    <ComboboxItem key={item} value={item}>
      {staticItemLabel(item)}
    </ComboboxItem>
  );

  if (groupedItems) {
    return (
      <ComboboxList>
        {(group: ComboboxItemGroup) => (
          <ComboboxGroup items={group.items} key={group.value}>
            {group.value && <ComboboxLabel>{group.value}</ComboboxLabel>}
            <ComboboxCollection>{renderStaticItem}</ComboboxCollection>
          </ComboboxGroup>
        )}
      </ComboboxList>
    );
  }

  return <ComboboxList>{renderStaticItem}</ComboboxList>;
};

const ComboboxPopupContent = ({
  isLoading,
  ...listProps
}: React.ComponentProps<typeof ComboboxItemsList> & {
  isLoading: boolean;
}) => {
  const t = useTranslations("core.global");

  if (listProps.isAsync && isLoading) {
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
      <ComboboxItemsList {...listProps} />
    </>
  );
};

const ComboboxChipValues = ({
  disabled,
  invalid,
  labels,
  maxVisibleChips,
  placeholder,
  renderChip,
  values,
}: {
  disabled?: boolean;
  invalid: boolean;
  labels: ComboboxOption[];
  maxVisibleChips?: number;
  placeholder: string;
  renderChip?: (item: ComboboxAsyncItem) => React.ReactNode;
  values: (ComboboxAsyncItem | string)[];
}) => {
  const hiddenCount =
    maxVisibleChips === undefined ? 0 : values.length - maxVisibleChips;

  return (
    <>
      <ComboboxChipList>
        {values.slice(0, maxVisibleChips).map(value => {
          const item =
            typeof value === "string"
              ? {
                  label: labels.find(l => l.value === value)?.label ?? value,
                  value,
                }
              : value;

          return (
            <ComboboxChip key={item.value}>
              {renderChip ? renderChip(item) : item.label}
            </ComboboxChip>
          );
        })}
        {hiddenCount > 0 && (
          <ComboboxChipOverflow count={hiddenCount} key="overflow" />
        )}
      </ComboboxChipList>
      <ComboboxChipsInput
        aria-invalid={invalid}
        disabled={disabled}
        placeholder={values.length === 0 ? placeholder : undefined}
      />
    </>
  );
};

const isEmptyAsyncItem = (value: unknown) =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as Partial<ComboboxAsyncItem>).value !== "string";

const toComboboxValue = <Value,>(
  value: Value,
  multiple: boolean,
): never[] | null | Value => {
  if (multiple) return Array.isArray(value) ? value : [];
  if (value === undefined || isEmptyAsyncItem(value)) return null;

  return value;
};

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
  maxVisibleChips,
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
  const anchor = useComboboxAnchor();
  const source = useComboboxSource({
    enumItems: otherProps?.enum ?? [],
    fetchData,
    filter,
    id,
    labels,
    onInputValueChange,
    placeholder,
    queryKey,
    searchPlaceholder,
  });
  const comboboxValue = toComboboxValue(field.value, multiple);
  const invalid = otherProps?.["aria-invalid"] ?? false;
  const onComboboxValueChange: ComboboxOnValueChange = (value, event) => {
    field.onChange(value);
    onValueChange?.(value, event);
  };
  const popupContent = (
    <ComboboxContent anchor={anchor}>
      <ComboboxPopupContent
        groupedItems={source.groupedItems}
        isAsync={source.isAsync}
        isLoading={source.isLoading}
        renderItem={renderItem}
        staticItemLabel={source.staticItemLabel}
      />
    </ComboboxContent>
  );

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
        defaultValue={comboboxValue}
        disabled={disabled}
        filter={source.filter}
        isItemEqualToValue={source.isItemEqualToValue}
        items={source.groupedItems ?? source.items}
        itemToStringLabel={source.itemToStringLabel}
        multiple={multiple}
        onInputValueChange={source.onInputValueChange}
        onValueChange={onComboboxValueChange}
        value={comboboxValue}
        {...props}
      >
        {multiple ? (
          <>
            <ComboboxChips className={className} ref={anchor}>
              <ComboboxValue>
                {(values: (ComboboxAsyncItem | string)[]) => (
                  <ComboboxChipValues
                    disabled={disabled}
                    invalid={invalid}
                    labels={labels}
                    maxVisibleChips={maxVisibleChips}
                    placeholder={source.inputPlaceholder}
                    renderChip={renderChip}
                    values={values}
                  />
                )}
              </ComboboxValue>
            </ComboboxChips>
            {popupContent}
          </>
        ) : (
          <>
            <ComboboxInput
              aria-invalid={invalid}
              className={className}
              disabled={disabled}
              placeholder={source.inputPlaceholder}
              showClear={showClear}
            />
            {popupContent}
          </>
        )}
      </Combobox>

      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
