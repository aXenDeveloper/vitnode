import type React from "react";

import { parseDateString, toDateString } from "@/components/ui/calendar-utils";
import { DatePicker } from "@/components/ui/date-picker";
import { FormControl, FormMessage } from "@/components/ui/form";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";

/**
 * A calendar picker for an `AutoForm` date field. Stores a local
 * `YYYY-MM-DD` string, or `undefined` when cleared. Spread the props
 * `AutoForm` passes and add a `label`.
 */
export const AutoFormDatePicker = ({
  label,
  labelRight,
  description,
  tip,
  field,
  onChange,
  allowClear,
  // oxlint-disable-next-line no-unused-vars
  itemParams,
  // oxlint-disable-next-line no-unused-vars
  multiLang,
  // oxlint-disable-next-line no-unused-vars
  children,
  otherProps: { isOptional },
  ...props
}: ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof DatePicker>, "onChange" | "value"> & {
    /** Called after the form value changes, with the new `YYYY-MM-DD` string, or `undefined` when cleared. */
    onChange?: (value: string | undefined) => void;
  }) => (
  <>
    {!!label && (
      <AutoFormLabel isOptional={isOptional} labelRight={labelRight} tip={tip}>
        {label}
      </AutoFormLabel>
    )}

    <FormControl>
      <DatePicker
        allowClear={allowClear ?? isOptional}
        name={field.name}
        onBlur={field.onBlur}
        onChange={date => {
          const value = date ? toDateString(date) : undefined;
          field.onChange(value);
          onChange?.(value);
        }}
        value={parseDateString(field.value)}
        {...props}
      />
    </FormControl>

    {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
    <FormMessage />
  </>
);
