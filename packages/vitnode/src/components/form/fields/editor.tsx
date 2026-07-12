import type React from "react";

import { Editor } from "@/components/ui/editor";
import { FormControl, FormMessage } from "@/components/ui/form";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";
import { MultiLangSelect, useMultiLangField } from "./multi-lang";

type AutoFormEditorProps = ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof Editor>, "onChange" | "value"> & {
    multiLang?: boolean;
  };

const MultiLangEditor = ({
  label,
  labelRight,
  description,
  isOptional,
  field,
  ...props
}: Omit<AutoFormEditorProps, "itemParams" | "multiLang" | "otherProps"> & {
  isOptional?: boolean;
}) => {
  const { languages, selected, setSelected, currentValue, setValue } =
    useMultiLangField(field);

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        {label && (
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
        <Editor
          key={selected}
          onBlur={field.onBlur}
          onChange={setValue}
          value={currentValue}
          {...props}
        />
      </FormControl>

      {description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};

export const AutoFormEditor = ({
  label,
  labelRight,
  description,
  otherProps: { isOptional },
  field,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  itemParams,
  multiLang,
  ...props
}: AutoFormEditorProps) => {
  if (multiLang) {
    return (
      <MultiLangEditor
        description={description}
        field={field}
        isOptional={isOptional}
        label={label}
        labelRight={labelRight}
        {...props}
      />
    );
  }

  return (
    <>
      {label && (
        <AutoFormLabel isOptional={isOptional} labelRight={labelRight}>
          {label}
        </AutoFormLabel>
      )}

      <FormControl>
        <Editor
          onBlur={field.onBlur}
          onChange={field.onChange}
          value={field.value ?? ""}
          {...props}
        />
      </FormControl>

      {description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
