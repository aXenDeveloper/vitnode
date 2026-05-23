import { InputGroup, InputGroupInput } from "@/components/ui/input-group";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { FormControl, FormMessage } from "../../ui/form";
import { Input } from "../../ui/input";
import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";

export const AutoFormInput = ({
  label,
  labelRight,
  description,
  otherProps: { isOptional, maxLength, minLength, pattern, type },
  field,
  children,
  ...props
}: ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof Input>, "value">) => {
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
            <InputGroupInput
              {...field}
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
              pattern={pattern}
              type={type ?? "text"}
              value={field.value ?? ""}
              {...props}
            />
          </FormControl>
          {children}
        </InputGroup>
      ) : (
        <FormControl>
          <Input
            {...field}
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
            pattern={pattern}
            type={type ?? "text"}
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
