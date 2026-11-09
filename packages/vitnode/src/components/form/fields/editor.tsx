import { cn } from "cn";
import { MessageCircleIcon } from "lucide-react";
import React from "react";
import { useLocale, useTranslations } from "use-intl";

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
import {
  isRichTextDocument,
  isRichTextEmpty,
} from "@/content/rich-text/document";
import { richTextToPlainText } from "@/content/rich-text/plain-text";
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

const GROW_WINDOW_MS = 700;

const EditorEnter = ({
  children,
  from,
}: {
  children: React.ReactNode;
  from?: number;
}) => {
  const innerRef = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState(from);

  React.useLayoutEffect(() => {
    const inner = innerRef.current;
    if (from === undefined || !inner) return;
    const observer = new ResizeObserver(() => {
      setHeight(inner.offsetHeight);
    });
    observer.observe(inner);
    const release = window.setTimeout(() => {
      observer.disconnect();
      setHeight(undefined);
    }, GROW_WINDOW_MS);

    return () => {
      observer.disconnect();
      window.clearTimeout(release);
    };
  }, [from]);

  if (from === undefined) return <>{children}</>;

  return (
    <div
      className={cn(
        "ease-fluid transition-[height,opacity,translate] duration-200 motion-reduce:transition-none starting:-translate-y-1 starting:opacity-0",
        height === undefined ? null : "-m-1 box-content overflow-hidden p-1",
      )}
      data-slot="editor-enter"
      style={{ height }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
};

const useEditorLabelledBy = (label: React.ReactNode): string | undefined => {
  const { formItemId } = useFormField();

  return label ? `${formItemId}-label` : undefined;
};

type AutoFormEditorProps = ItemAutoFormComponentProps &
  TipTapEditorBaseProps & {
    /**
     * Starts as a one-line field showing the `placeholder` (or a plain-text
     * preview of what the field already holds) and loads the full editor,
     * focused, once it is clicked. Keeps long forms short and defers loading
     * Tiptap until someone writes. Defaults to `false`.
     */
    collapsed?: boolean;
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
  enterFrom?: number;
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
  enterFrom,
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
      <EditorEnter from={enterFrom}>
        <Editor
          aria-labelledby={labelledBy}
          key={selected}
          onBlur={field.onBlur}
          onChange={setValue}
          value={currentValue}
          {...props}
        />
      </EditorEnter>
    </MultiLangEditorLayout>
  );
};

const MultiLangJsonEditor = ({
  enterFrom,
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
      <EditorEnter from={enterFrom}>
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
      </EditorEnter>
    </MultiLangEditorLayout>
  );
};

const previewText = (value: unknown, locale: string): string => {
  if (typeof value === "string") return stripHtml(value).trim();
  if (Array.isArray(value)) {
    const texts = (value as MultiLangValue<unknown>).flatMap(item => {
      const text = previewText(item.value, locale);

      return text ? [{ languageCode: item.languageCode, text }] : [];
    });

    return (
      (texts.find(item => item.languageCode === locale) ?? texts[0])?.text ?? ""
    );
  }

  return isRichTextDocument(value) ? richTextToPlainText(value) : "";
};

const CollapsedEditor = ({
  description,
  isOptional,
  label,
  labelRight,
  onActivate,
  placeholder,
  tip,
  value,
}: Pick<
  AutoFormEditorProps,
  "description" | "label" | "labelRight" | "placeholder" | "tip"
> & {
  isOptional?: boolean;
  onActivate: (height: number) => void;
  value: unknown;
}) => {
  const t = useTranslations("core.global.editor");
  const locale = useLocale();
  const preview = previewText(value, locale);

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
        <button
          className="border-input bg-card hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:hover:bg-input/50 flex min-h-11 w-full cursor-text items-start gap-3 rounded-md border px-3 py-2.5 text-start text-base shadow-xs transition-[color,background-color,border-color,box-shadow] duration-150 ease-out outline-none focus-visible:ring-3 aria-invalid:ring-3 md:text-sm"
          data-slot="editor-collapsed"
          onClick={event => {
            onActivate(event.currentTarget.offsetHeight);
          }}
          type="button"
        >
          <MessageCircleIcon
            aria-hidden="true"
            className="text-muted-foreground mt-0.5 size-4 shrink-0"
          />
          <span
            className={
              preview
                ? "text-foreground line-clamp-3 min-w-0 flex-1 leading-relaxed whitespace-pre-line"
                : "text-muted-foreground min-w-0 flex-1 leading-relaxed"
            }
          >
            {preview || (placeholder ?? t("placeholder"))}
          </span>
        </button>
      </FormControl>

      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};

/**
 * The rich-text editor (Tiptap) as an `AutoForm` field. Spread the props `AutoForm` passes and add a `label`.
 *
 * Inside a collaborative editing context, a `json` field edits the shared
 * document instead of a local one.
 */
export const AutoFormEditor = ({
  collapsed = false,
  label,
  labelRight,
  description,
  otherProps: { isOptional },
  field,
  format = "html",
  // oxlint-disable-next-line no-unused-vars
  itemParams,
  multiLang,
  onEditor,
  tip,
  ...rest
}: AutoFormEditorProps) => {
  const labelledBy = useEditorLabelledBy(label);
  const collaborative = React.use(EditorCollaborationContext);
  const [active, setActive] = React.useState(!collapsed);
  const [enterFrom, setEnterFrom] = React.useState<number>();
  const focusOnLoadRef = React.useRef(false);
  const focusOnLoad: TipTapEditorBaseProps["onEditor"] = editor => {
    onEditor?.(editor);
    if (editor && focusOnLoadRef.current) {
      focusOnLoadRef.current = false;
      editor.commands.focus("end");
    }
  };
  const props = { ...rest, onEditor: focusOnLoad };

  if (!active) {
    return (
      <CollapsedEditor
        description={description}
        isOptional={isOptional}
        label={label}
        labelRight={labelRight}
        onActivate={height => {
          setEnterFrom(height);
          focusOnLoadRef.current = true;
          setActive(true);
        }}
        placeholder={rest.placeholder}
        tip={tip}
        value={field.value}
      />
    );
  }

  if (multiLang && format === "json") {
    return (
      <MultiLangJsonEditor
        description={description}
        enterFrom={enterFrom}
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
        enterFrom={enterFrom}
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

      <EditorEnter from={enterFrom}>
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
      </EditorEnter>

      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
