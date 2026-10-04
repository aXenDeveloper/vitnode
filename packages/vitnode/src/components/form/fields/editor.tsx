import type React from "react";

import { Editor } from "@/components/ui/editor";
import { FormControl, FormMessage, useFormField } from "@/components/ui/form";
import { stripHtml } from "@/lib/strip-html";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";
import {
  type MultiLangFieldProps,
  MultiLangSelect,
  useMultiLangField,
} from "./multi-lang";
import { MultiLangSelectedContext } from "./multi-lang-language";

const hasHtmlText = (html: string): boolean => stripHtml(html) !== "";

const useEditorLabelledBy = (label: React.ReactNode): string | undefined => {
  const { formItemId } = useFormField();

  return label ? `${formItemId}-label` : undefined;
};

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
}: MultiLangFieldProps &
  Omit<
    AutoFormEditorProps,
    "field" | "itemParams" | "multiLang" | "otherProps"
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
  } = useMultiLangField(field, { isFilled: hasHtmlText });
  const labelledBy = useEditorLabelledBy(label);

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        {!!label && (
          <AutoFormLabel isOptional={isOptional} labelRight={labelRight}>
            {label}
          </AutoFormLabel>
        )}
        {canSelect && (
          <MultiLangSelect
            languages={languages}
            onSelect={setSelected}
            selected={selected}
          />
        )}
      </div>

      <FormControl>
        {/* Tells editor tools (Quick Ask) which language this text is in. */}
        <MultiLangSelectedContext value={selected}>
          <Editor
            aria-labelledby={labelledBy}
            key={selected}
            onBlur={field.onBlur}
            onChange={setValue}
            value={currentValue}
            {...props}
          />
        </MultiLangSelectedContext>
      </FormControl>

      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
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
  const labelledBy = useEditorLabelledBy(label);

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
      {!!label && (
        <AutoFormLabel isOptional={isOptional} labelRight={labelRight}>
          {label}
        </AutoFormLabel>
      )}

      <FormControl>
        <Editor
          aria-labelledby={labelledBy}
          onBlur={field.onBlur}
          onChange={field.onChange}
          value={field.value ?? ""}
          {...props}
        />
      </FormControl>

      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
