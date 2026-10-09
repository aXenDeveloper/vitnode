import type React from "react";

import { parseDateString, toDateString } from "@/components/ui/calendar-utils";
import { DatePicker } from "@/components/ui/date-picker";
import { FormControl, FormMessage } from "@/components/ui/form";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";

export const AutoFormDatePicker = ({
  label,
  labelRight,
  description,
  field,
  onChange,
  allowClear,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  itemParams,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  multiLang,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  children,
  otherProps: { isOptional },
  ...props
}: ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof DatePicker>, "onChange" | "value"> & {
    onChange?: (value: string | undefined) => void;
  }) => (
  <>
    {!!label && (
      <AutoFormLabel isOptional={isOptional} labelRight={labelRight}>
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
