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
    /** Text between the input and the toggle, e.g. "or". */
    orLabel?: React.ReactNode;
    placeholder?: string;
    /** The number restored when the toggle is unchecked before anything was typed. */
    resumeValue?: number;
    /** The checkbox that sets the value to `null`, e.g. "Unlimited". */
    toggleLabel: React.ReactNode;
    /** Shown after the input, e.g. `MB` or `days`. */
    unitLabel?: React.ReactNode;
  };

/**
 * A number input with a checkbox that stores `null` instead - for a limit that
 * can be switched off. Use with a `z.number().nullable()` field. Spread the props `AutoForm` passes and add a `label`.
 */
export const AutoFormNullableNumber = ({
  label,
  labelRight,
  description,
  tip,
  field,
  otherProps: { isOptional },
  // oxlint-disable-next-line no-unused-vars
  itemParams,
  // Only the language-aware inputs implement this - dropped here so it never
  // lands on the DOM element the rest props spread into.
  // oxlint-disable-next-line no-unused-vars
  multiLang,
  className,
  disabled,
  placeholder,
  resumeValue = 0,
  unitLabel,
  orLabel,
  toggleLabel,
  ...props
}: AutoFormNullableNumberProps) => {
  const { formItemId } = useFormField();
  const isToggled = field.value === null;
  const lastNumericRef = React.useRef(
    typeof field.value === "number" ? field.value : resumeValue,
  );

  return (
    <>
      {!!label && (
        <AutoFormLabel
          isOptional={isOptional}
          labelRight={labelRight}
          tip={tip}
        >
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
