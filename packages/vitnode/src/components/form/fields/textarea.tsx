import type React from "react";

import { FormControl, FormMessage } from "@/components/ui/form";
import { InputGroup, InputGroupTextarea } from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";

export const AutoFormTextarea = ({
  label,
  description,
  labelRight,
  otherProps: { isOptional, maxLength, minLength },
  field,
  children,
  ...props
}: ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof Textarea>, "value"> & {
    description?: React.ReactNode;
    label?: React.ReactNode;
  }) => {
  return (
    <>
      {label && (
        <AutoFormLabel isOptional={isOptional} labelRight={labelRight}>
          {label}
        </AutoFormLabel>
      )}

      {children ? (
        <InputGroup>
          <FormControl>
            <InputGroupTextarea
              maxLength={maxLength}
              minLength={minLength}
              onBlur={e => {
                field.onBlur();
                props.onBlur?.(e);
              }}
              onChange={e => {
                field.onChange(e);
                props.onChange?.(e);
              }}
              value={field.value ?? ""}
              {...props}
            />
          </FormControl>
          {children}
        </InputGroup>
      ) : (
        <FormControl>
          <Textarea
            maxLength={maxLength}
            minLength={minLength}
            onBlur={e => {
              field.onBlur();
              props.onBlur?.(e);
            }}
            onChange={e => {
              field.onChange(e);
              props.onChange?.(e);
            }}
            value={field.value ?? ""}
            {...props}
          />
        </FormControl>
      )}

      {description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
