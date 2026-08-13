import type React from "react";

import { useTranslations } from "next-intl";

import { FormControl, FormMessage } from "@/components/ui/form";
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  itemParams,
  // Only the language-aware inputs implement this - dropped here so it never
  // lands on the DOM element the rest props spread into.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  multiLang,
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

  return (
    <>
      {!!label && (
        <AutoFormLabel isOptional={isOptional} labelRight={labelRight}>
          {label}
        </AutoFormLabel>
      )}

      <FormControl>
        <Select
          items={values}
          value={field.value ?? null}
          {...props}
          onValueChange={(value, eventDetails) => {
            field.onChange(value);
            props.onValueChange?.(value, eventDetails);
          }}
        >
          <SelectTrigger onBlur={field.onBlur}>
            <SelectValue placeholder={placeholder ?? t("select_option")} />
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

      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
