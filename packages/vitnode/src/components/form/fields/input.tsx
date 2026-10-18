import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { getMultiLangConstraints } from "@/lib/helpers/multi-lang";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { FormControl, FormMessage } from "../../ui/form";
import { Input } from "../../ui/input";
import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";
import {
  type MultiLangFieldProps,
  MultiLangLabel,
  useMultiLangField,
} from "./multi-lang";

type AutoFormInputProps = ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof Input>, "value"> & {
    multiLang?: boolean;
  };

const MultiLangInput = ({
  label,
  labelRight,
  description,
  tip,
  isOptional,
  field,
  itemParams,
  pattern,
  type,
  ...props
}: MultiLangFieldProps &
  Omit<
    AutoFormInputProps,
    "children" | "field" | "multiLang" | "otherProps"
  > & {
    isOptional?: boolean;
  }) => {
  const {
    canSelect,
    languages,
    selected,
    setSelected,
    currentValue,
    setValue,
  } = useMultiLangField(field);
  const { maxLength, minLength } = getMultiLangConstraints(itemParams);

  return (
    <>
      <MultiLangLabel
        canSelect={canSelect}
        isOptional={isOptional}
        label={label}
        labelRight={labelRight}
        languages={languages}
        onSelect={setSelected}
        selected={selected}
        tip={tip}
      />

      <FormControl>
        <Input
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
      </FormControl>

      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};

/**
 * A single-line text input for an `AutoForm` string field. Length limits and
 * `pattern` come from the schema; `type` comes from the schema (`email`
 * format) or the key name (`password`). Other input props pass through.
 * Spread the props `AutoForm` passes and add a `label`.
 *
 * With `multiLang`, edits one value per enabled language. Pass `children` to
 * render them as addons inside an input group.
 */
export const AutoFormInput = ({
  label,
  labelRight,
  description,
  tip,
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
        tip={tip}
        {...props}
      />
    );
  }

  const { isOptional, maxLength, minLength, pattern, type } = otherProps;

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

      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
