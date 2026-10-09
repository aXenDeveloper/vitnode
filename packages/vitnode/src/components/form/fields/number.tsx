import { cn } from "cn";
import React from "react";

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

type AutoFormNumberProps = ItemAutoFormComponentProps &
  Omit<
    React.ComponentProps<typeof NumberField>,
    "children" | "defaultValue" | "id" | "name" | "onValueChange" | "value"
  > & {
    placeholder?: string;
    unitLabel?: React.ReactNode;
  };

export const AutoFormNumber = ({
  className,
  description,
  field,
  // oxlint-disable-next-line no-unused-vars
  itemParams,
  label,
  labelRight,
  // oxlint-disable-next-line no-unused-vars
  multiLang,
  otherProps: { isOptional },
  placeholder,
  unitLabel,
  ...props
}: AutoFormNumberProps) => {
  const { formItemId } = useFormField();

  return (
    <>
      {!!label && (
        <AutoFormLabel isOptional={isOptional} labelRight={labelRight}>
          {label}
        </AutoFormLabel>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <NumberField
          className={cn("w-48", className)}
          id={formItemId}
          name={field.name}
          onValueChange={value => {
            field.onChange(value);
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
      </div>

      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
