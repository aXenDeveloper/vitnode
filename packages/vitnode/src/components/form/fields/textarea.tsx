import type React from "react";

import { FormControl, FormMessage } from "@/components/ui/form";
import { InputGroup, InputGroupTextarea } from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { getMultiLangConstraints } from "@/lib/helpers/multi-lang";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";
import { MultiLangSelect, useMultiLangField } from "./multi-lang";

type AutoFormTextareaProps = ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof Textarea>, "value"> & {
    description?: React.ReactNode;
    label?: React.ReactNode;
    multiLang?: boolean;
  };

/**
 * The same textarea, holding one value per language.
 *
 * The switcher sits beside the label rather than inside the box, which is where
 * `AutoFormEditor` puts it too: a textarea is resizable and multi-line, so an
 * inline addon would end up floating in the middle of the control.
 */
const MultiLangTextarea = ({
  label,
  labelRight,
  description,
  isOptional,
  field,
  itemParams,
  ...props
}: Omit<AutoFormTextareaProps, "children" | "multiLang" | "otherProps"> & {
  isOptional?: boolean;
}) => {
  const { languages, selected, setSelected, currentValue, setValue } =
    useMultiLangField(field);
  const { maxLength, minLength } = getMultiLangConstraints(itemParams);

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        {!!label && (
          <AutoFormLabel isOptional={isOptional} labelRight={labelRight}>
            {label}
          </AutoFormLabel>
        )}
        {languages.length > 1 && (
          <MultiLangSelect
            languages={languages}
            onSelect={setSelected}
            selected={selected}
          />
        )}
      </div>

      <FormControl>
        <Textarea
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
          value={currentValue}
        />
      </FormControl>

      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};

export const AutoFormTextarea = ({
  label,
  description,
  labelRight,
  otherProps,
  field,
  itemParams,
  children,
  multiLang,
  ...props
}: AutoFormTextareaProps) => {
  if (multiLang) {
    return (
      <MultiLangTextarea
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

  const { isOptional, maxLength, minLength } = otherProps;

  return (
    <>
      {!!label && (
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

      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
