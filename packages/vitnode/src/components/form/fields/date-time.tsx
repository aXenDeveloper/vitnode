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
 * A date and time field backed by the platform's `datetime-local` input.
 *
 * The form value is an ISO 8601 string (or `null` for a nullable field), which
 * is exactly what the generated API accepts - Zod v4 cannot turn `z.date()`
 * into JSON Schema, and `AutoForm` runs `z.toJSONSchema` on every schema.
 */
export const AutoFormDateTime = ({
  label,
  labelRight,
  description,
  field,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  itemParams,
  otherProps: { isOptional },
  ...props
}: ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof Input>, "type" | "value">) => {
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
            props.onBlur?.(event);
          }}
          onChange={event => {
            const { value } = event.target;
            // An emptied input means "no value" - `null` when the field allows
            // it, otherwise an empty string so validation reports it.
            field.onChange(value === "" ? null : new Date(value).toISOString());
            props.onChange?.(event);
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
