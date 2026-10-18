import type React from "react";

import { FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";

/** `2026-08-02T10:00:00.000Z` -> `2026-08-02T10:00`, what the input expects. */
const toInputValue = (value: unknown): string => {
  if (typeof value !== "string" || value === "") return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (part: number) => String(part).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/**
 * A native `datetime-local` input for an `AutoForm` date-time field. Shows
 * the value in the browser's time zone and stores it as an ISO string in UTC;
 * clearing it stores `null` (`""` when `otherProps.clearsToEmpty` is set, as the Content Engine does for
 * optional, non-nullable fields). Spread the
 * props `AutoForm` passes and add a `label`; your own `onChange` and `onBlur`
 * run after the form value updates.
 */
export const AutoFormDateTime = ({
  label,
  labelRight,
  description,
  field,
  // oxlint-disable-next-line no-unused-vars
  itemParams,
  // Only the language-aware inputs implement this - dropped here so it never
  // lands on the DOM element the rest props spread into.
  // oxlint-disable-next-line no-unused-vars
  multiLang,
  otherProps: { clearsToEmpty, isOptional },
  onBlur,
  onChange,
  ...props
}: ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof Input>, "type" | "value">) => {
  const cleared = clearsToEmpty ? "" : null;

  return (
    <>
      {!!label && (
        <AutoFormLabel isOptional={isOptional} labelRight={labelRight}>
          {label}
        </AutoFormLabel>
      )}

      <FormControl>
        <Input
          onBlur={event => {
            field.onBlur();
            onBlur?.(event);
          }}
          onChange={event => {
            const { value } = event.target;
            const date = value === "" ? null : new Date(value);
            field.onChange(
              date && !Number.isNaN(date.getTime())
                ? date.toISOString()
                : cleared,
            );
            onChange?.(event);
          }}
          type="datetime-local"
          value={toInputValue(field.value)}
          {...props}
        />
      </FormControl>

      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
