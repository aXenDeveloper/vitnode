import { useQuery } from "@tanstack/react-query";
import React from "react";
import { useDebouncedCallback } from "use-debounce";
import { useTranslations } from "use-intl";

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

/**
 * Where a *synchronous* combobox's disabled query sits.
 *
 * Only ever reached when no `fetchData` was supplied, which is the case the
 * props type below leaves without a `queryKey`. That query is `enabled: false`,
 * so the entry never holds anything - but it is named after its own inertness
 * rather than after a plausible `["combobox", …]` that a reader could mistake
 * for a real cache root, and it is *not* re-keyed on the search term, so an
 * option list nobody is fetching does not leave an entry per keystroke behind.
 */
export const COMBOBOX_INERT_QUERY_KEY = "combobox:no-fetcher";

/**
 * The async half's `queryKey` is **required**, and that is the whole of it.
 *
 * It used to be optional with a fallback of `[id ?? "combobox", { search }]`,
 * which meant a picker whose author forgot both props shared one cache entry
 * with every other picker in the application - an entry outside `["vitnode",
 * "admin"]`, which is the prefix a sign-out removes. Two administrators' search
 * results in one key that nothing drops. Every real caller passed a key already;
 * requiring it is what stops the next one relying on the trap.
 *
 * `id` stays required alongside it for the DOM, and the two are separate: `id`
 * identifies the control, `queryKey` identifies the *answers*, and a picker
 * offering categories caches under the categories rather than under the form it
 * happens to sit in.
 */
type AutoFormComboboxProps = ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof Combobox>, "items" | "value"> & {
    className?: string;
    labels?: { label: string; value: string }[];
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
    enabled: isAsync,
    /**
     * `retry: false`, the rule every AdminCP read follows.
     *
     * A picker's options come from the same admin API as the screen around it: a
     * `403` is an authorization answer, and a `429` answered by sending the same
     * search twice more is what the limiter asked the application to stop doing.
     * A picker is also the one control where a retry is least useful - the
     * reader is typing, and the next keystroke asks again anyway.
     */
    retry: false,
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
