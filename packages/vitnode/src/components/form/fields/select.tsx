import { useTranslations } from "next-intl";
import type React from "react";

import { FormControl, FormItem, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";

export const AutoFormSelect = ({
  label,
  field,
  description,
  otherProps: { enum: enumValues = [], isOptional },
  placeholder,
  labelRight,
  labels = [],
  ...props
}: ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof Select>, "value"> & {
    labels?: { label: string; value: string }[];
    placeholder?: string;
  }) => {
  const t = useTranslations("core.global");
  const values: { label: string; value: string }[] = enumValues.map(value => {
    const label = labels.find(l => l.value === value)?.label;

    return {
      value,
      label: label ?? value,
    };
  });

  const currentPlaceholder =
    (values ?? labels).find(l => l.value === field.value)?.label ??
    t("select_option");

  return (
    <FormItem className="space-y-3">
      {label && (
        <AutoFormLabel isOptional={isOptional} labelRight={labelRight}>
          {label}
        </AutoFormLabel>
      )}

      <FormControl>
        <Select
          defaultValue={field.value}
          disabled={props.disabled}
          onValueChange={e => {
            field.onChange(e);
            props?.onValueChange?.(e);
          }}
          {...props}
        >
          <SelectTrigger {...props}>
            <SelectValue
              onBlur={field.onBlur}
              placeholder={placeholder ?? currentPlaceholder}
            >
              {currentPlaceholder}
            </SelectValue>
          </SelectTrigger>

          <SelectContent>
            {values.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormControl>

      {description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </FormItem>
  );
};
