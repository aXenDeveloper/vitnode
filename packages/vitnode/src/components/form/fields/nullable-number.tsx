import { cn } from "cn";
import React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormMessage, useFormField } from "@/components/ui/form";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";

type AutoFormNullableNumberProps = ItemAutoFormComponentProps &
  Omit<
    React.ComponentProps<typeof NumberField>,
    "children" | "defaultValue" | "id" | "name" | "onValueChange" | "value"
  > & {
    orLabel?: React.ReactNode;
    placeholder?: string;
    toggleLabel: React.ReactNode;
    unitLabel?: React.ReactNode;
  };

export const AutoFormNullableNumber = ({
  label,
  labelRight,
  description,
  field,
  otherProps: { isOptional },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  itemParams,
  // Only the language-aware inputs implement this - dropped here so it never
  // lands on the DOM element the rest props spread into.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  multiLang,
  className,
  disabled,
  placeholder,
  unitLabel,
  orLabel,
  toggleLabel,
  ...props
}: AutoFormNullableNumberProps) => {
  const { formItemId } = useFormField();
  const isToggled = field.value === null;
  const lastNumericRef = React.useRef(
    typeof field.value === "number" ? field.value : 0,
  );

  return (
    <>
      {!!label && (
        <AutoFormLabel isOptional={isOptional} labelRight={labelRight}>
          {label}
        </AutoFormLabel>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <NumberField
          className={cn("w-40", className)}
          disabled={isToggled || disabled}
          id={formItemId}
          name={field.name}
          onValueChange={value => {
            const next = value ?? 0;
            lastNumericRef.current = next;
            field.onChange(next);
          }}
          value={typeof field.value === "number" ? field.value : null}
          {...props}
        >
          <NumberFieldGroup>
            <NumberFieldDecrement />
            <FormControl>
              <NumberFieldInput
                onBlur={field.onBlur}
                placeholder={placeholder}
              />
            </FormControl>
            <NumberFieldIncrement />
          </NumberFieldGroup>
        </NumberField>

        {!!unitLabel && (
          <span className="text-muted-foreground text-sm">{unitLabel}</span>
        )}
        {!!orLabel && (
          <span className="text-muted-foreground text-sm">{orLabel}</span>
        )}

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={isToggled}
            disabled={disabled}
            onCheckedChange={checked => {
              field.onChange(checked ? null : lastNumericRef.current);
            }}
          />
          {toggleLabel}
        </label>
      </div>

      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
