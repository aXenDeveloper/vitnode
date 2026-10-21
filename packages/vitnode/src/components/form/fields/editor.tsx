import React from "react";

import type { TipTapEditorBaseProps } from "@/components/tiptap/tiptap-editor";
import type { FormFieldApi } from "@/components/ui/form";
import type { RichTextDocument } from "@/content/rich-text/document";
import type { MultiLangValue } from "@/lib/helpers/multi-lang";

import {
  CollaborativeEditorSlot,
  EditorCollaborationContext,
} from "@/components/tiptap/collaboration";
import { reusableEditorUploads } from "@/components/tiptap/uploads/reuse";
import { Editor } from "@/components/ui/editor";
import { FormControl, FormMessage, useFormField } from "@/components/ui/form";
import { isRichTextEmpty } from "@/content/rich-text/document";
import { stripHtml } from "@/lib/strip-html";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";
import {
  type MultiLangFieldProps,
  MultiLangLabel,
  useMultiLangField,
  useMultiLangValueField,
} from "./multi-lang";
import { MultiLangSelectedContext } from "./multi-lang-language";

const hasHtmlText = (html: string): boolean => stripHtml(html) !== "";

const hasDocumentContent = (
  value: null | RichTextDocument | undefined,
): boolean => !isRichTextEmpty(value);

const useEditorLabelledBy = (label: React.ReactNode): string | undefined => {
  const { formItemId } = useFormField();

  return label ? `${formItemId}-label` : undefined;
};

type AutoFormEditorProps = ItemAutoFormComponentProps &
  TipTapEditorBaseProps & {
    /**
     * What the field stores: an HTML string (`html`) or a Tiptap JSON document
     * (`json`, required for rich text in the Content Engine and for
     * collaborative editing). Defaults to `html`.
     */
    format?: "html" | "json";
    /** Edits one document per enabled language. */
    multiLang?: boolean;
  };

type MultiLangEditorProps<TField> = Omit<
  AutoFormEditorProps,
  "field" | "format" | "itemParams" | "multiLang" | "otherProps"
> & {
  field: TField;
  isOptional?: boolean;
};

const MultiLangEditorLayout = ({
  canSelect,
  children,
  description,
  isOptional,
  label,
  labelRight,
  languages,
  onSelect,
  selected,
  tip,
}: {
  canSelect: boolean;
  children: React.ReactNode;
  description?: React.ReactNode;
  isOptional?: boolean;
  label?: React.ReactNode;
  labelRight?: React.ReactNode;
  languages: React.ComponentProps<typeof MultiLangLabel>["languages"];
  onSelect: (code: string) => void;
  selected: string;
  tip?: React.ReactNode;
}) => (
  <>
    <MultiLangLabel
      canSelect={canSelect}
      isOptional={isOptional}
      label={label}
      labelRight={labelRight}
      languages={languages}
      onSelect={onSelect}
      selected={selected}
      tip={tip}
    />

    <FormControl>
      <MultiLangSelectedContext value={selected}>
        {children}
      </MultiLangSelectedContext>
    </FormControl>

    {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
    <FormMessage />
  </>
);

const MultiLangHtmlEditor = ({
  label,
  labelRight,
  description,
  isOptional,
  field,
  tip,
  ...props
}: MultiLangEditorProps<MultiLangFieldProps["field"]>) => {
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
    <MultiLangEditorLayout
      canSelect={canSelect}
      description={description}
      isOptional={isOptional}
      label={label}
      labelRight={labelRight}
      languages={languages}
      onSelect={setSelected}
      selected={selected}
      tip={tip}
    >
      <Editor
        aria-labelledby={labelledBy}
        key={selected}
        onBlur={field.onBlur}
        onChange={setValue}
        value={currentValue}
        {...props}
      />
    </MultiLangEditorLayout>
  );
};

const MultiLangJsonEditor = ({
  label,
  labelRight,
  description,
  isOptional,
  field,
  tip,
  ...props
}: MultiLangEditorProps<
  FormFieldApi<MultiLangValue<null | RichTextDocument> | undefined>
>) => {
  const {
    canSelect,
    languages,
    selected,
    setSelected,
    currentValue,
    setValue,
  } = useMultiLangValueField<null | RichTextDocument>(field, {
    isFilled: hasDocumentContent,
  });
  const labelledBy = useEditorLabelledBy(label);
  const collaborative = React.use(EditorCollaborationContext);
  const reusableUploads = props.uploads
    ? reusableEditorUploads(field.value ?? undefined, selected)
    : undefined;

  return (
    <MultiLangEditorLayout
      canSelect={canSelect}
      description={description}
      isOptional={isOptional}
      label={label}
      labelRight={labelRight}
      languages={languages}
      onSelect={setSelected}
      selected={selected}
      tip={tip}
    >
      {collaborative ? (
        <CollaborativeEditorSlot
          aria-labelledby={labelledBy}
          key={selected}
          locale={selected}
          onBlur={field.onBlur}
          onChange={setValue}
          render={collaborative}
          reusableUploads={reusableUploads}
          value={currentValue ?? null}
          {...props}
        />
      ) : (
        <Editor
          aria-labelledby={labelledBy}
          format="json"
          key={selected}
          onBlur={field.onBlur}
          onChange={setValue}
          reusableUploads={reusableUploads}
          value={currentValue ?? null}
          {...props}
        />
      )}
    </MultiLangEditorLayout>
  );
};

/**
 * The rich-text editor (Tiptap) as an `AutoForm` field. Spread the props `AutoForm` passes and add a `label`.
 *
 * Inside a collaborative editing context, a `json` field edits the shared
 * document instead of a local one.
 */
export const AutoFormEditor = ({
  label,
  labelRight,
  description,
  otherProps: { isOptional },
  field,
  format = "html",
  // oxlint-disable-next-line no-unused-vars
  itemParams,
  multiLang,
  tip,
  ...props
}: AutoFormEditorProps) => {
  const labelledBy = useEditorLabelledBy(label);
  const collaborative = React.use(EditorCollaborationContext);

  if (multiLang && format === "json") {
    return (
      <MultiLangJsonEditor
        description={description}
        field={field}
        isOptional={isOptional}
        label={label}
        labelRight={labelRight}
        tip={tip}
        {...props}
      />
    );
  }

  if (multiLang) {
    return (
      <MultiLangHtmlEditor
        description={description}
        field={field}
        isOptional={isOptional}
        label={label}
        labelRight={labelRight}
        tip={tip}
        {...props}
      />
    );
  }

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

      <FormControl>
        {format === "json" && collaborative ? (
          <CollaborativeEditorSlot
            aria-labelledby={labelledBy}
            locale={null}
            onBlur={field.onBlur}
            onChange={field.onChange}
            render={collaborative}
            value={field.value ?? null}
            {...props}
          />
        ) : format === "json" ? (
          <Editor
            aria-labelledby={labelledBy}
            format="json"
            onBlur={field.onBlur}
            onChange={field.onChange}
            value={field.value ?? null}
            {...props}
          />
        ) : (
          <Editor
            aria-labelledby={labelledBy}
            onBlur={field.onBlur}
            onChange={field.onChange}
            value={field.value ?? ""}
            {...props}
          />
        )}
      </FormControl>

      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
