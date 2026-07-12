import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { getMultiLangConstraints } from "@/lib/helpers/multi-lang";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { FormControl, FormMessage } from "../../ui/form";
import { Input } from "../../ui/input";
import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";
import { MultiLangSelect, useMultiLangField } from "./multi-lang";

type AutoFormInputProps = ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof Input>, "value"> & {
    multiLang?: boolean;
  };

const MultiLangInput = ({
  label,
  labelRight,
  description,
  isOptional,
  field,
  itemParams,
  pattern,
  type,
  ...props
}: Omit<AutoFormInputProps, "children" | "multiLang" | "otherProps"> & {
  isOptional?: boolean;
}) => {
  const { languages, selected, setSelected, currentValue, setValue } =
    useMultiLangField(field);
  const { maxLength, minLength } = getMultiLangConstraints(itemParams);

  return (
    <>
      {label && (
        <AutoFormLabel isOptional={isOptional} labelRight={labelRight}>
          {label}
        </AutoFormLabel>
      )}

      <FormControl>
        <InputGroup>
          <InputGroupInput
            {...field}
            {...props}
            maxLength={maxLength}
            minLength={minLength}
            onBlur={e => {
              field.onBlur();
              props.onBlur?.(e);
            }}
            onChange={e => {
              setValue(e.target.value);
              props.onChange?.(e);
            }}
            pattern={pattern}
            type={type ?? "text"}
            value={currentValue}
          />
          {languages.length > 1 && (
            <InputGroupAddon align="inline-end">
              <MultiLangSelect
                languages={languages}
                onSelect={setSelected}
                selected={selected}
              />
            </InputGroupAddon>
          )}
        </InputGroup>
      </FormControl>

      {description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};

export const AutoFormInput = ({
  label,
  labelRight,
  description,
  otherProps,
  field,
  itemParams,
  children,
  multiLang,
  ...props
}: AutoFormInputProps) => {
  if (multiLang) {
    return (
      <MultiLangInput
        description={description}
        field={field}
        isOptional={otherProps.isOptional}
        itemParams={itemParams}
        label={label}
        labelRight={labelRight}
        {...props}
      />
    );
  }

  const { isOptional, maxLength, minLength, pattern, type } = otherProps;

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
