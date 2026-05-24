import type React from "react";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";

interface ItemAutoFormRadioGroupLabelsProps {
  description?: string;
  disabled?: boolean;
  label: string;
  value: string;
}

export const AutoFormRadioGroup = ({
  label,
  labelRight,
  field,
  description,
  otherProps: { enum: enumValues = [], isOptional },
  labels = [],
  variant = "default",
  ...props
}: ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof RadioGroup>, "value"> & {
    labels?: ItemAutoFormRadioGroupLabelsProps[];
    variant?: "blocks" | "default";
  }) => {
  const values: ItemAutoFormRadioGroupLabelsProps[] = enumValues.map(value => {
    const item = labels.find(l => l.value === value);

    return {
      value,
      label: item?.label ?? value,
      description: item?.description,
      disabled: item?.disabled,
    };
  });

  return (
    <div className="space-y-3">
      {label && (
        <AutoFormLabel isOptional={isOptional} labelRight={labelRight}>
          {label}
        </AutoFormLabel>
      )}
      {description && <AutoFormDesc>{description}</AutoFormDesc>}

      <FormControl>
        <RadioGroup
          defaultValue={field.value}
          disabled={props.disabled}
          onValueChange={field.onChange}
          {...props}
        >
          {values.map(({ value, label, description, disabled }) =>
            variant === "default" ? (
              <Field
                data-disabled={disabled}
                key={`${field.name}-${value}`}
                orientation="horizontal"
              >
                <FormControl>
                  <RadioGroupItem
                    disabled={disabled}
                    id={`${field.name}-${value}`}
                    value={value}
                  />
                </FormControl>
                <FieldContent>
                  <FieldLabel htmlFor={`${field.name}-${value}`}>
                    {label}
                  </FieldLabel>
                  {description && (
                    <FieldDescription>{description}</FieldDescription>
                  )}
                </FieldContent>
              </Field>
            ) : (
              <FieldLabel
                htmlFor={`${field.name}-${value}`}
                key={`${field.name}-${value}`}
              >
                <Field data-disabled={disabled} orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>{label}</FieldTitle>
                    {description && (
                      <FieldDescription>{description}</FieldDescription>
                    )}
                  </FieldContent>
                  <FormControl>
                    <RadioGroupItem
                      disabled={disabled}
                      id={`${field.name}-${value}`}
                      value={value}
                    />
                  </FormControl>
                </Field>
              </FieldLabel>
            ),
          )}
        </RadioGroup>
      </FormControl>

      <FormMessage />
    </div>
  );
};
