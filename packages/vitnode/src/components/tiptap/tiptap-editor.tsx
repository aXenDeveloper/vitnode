import {
  type Editor,
  EditorContent,
  type Extensions,
  useEditor,
} from "@tiptap/react";
import { cn } from "cn";
import React from "react";
import { useTranslations } from "use-intl";

import type { RichTextDocument } from "@/content/rich-text/document";

import { useEditorConfig } from "@/components/editor-provider";

import { TipTapDragHandle } from "./drag-handle";
import { EditorSkeleton } from "./editor-skeleton";
import { createTipTapExtensions } from "./extension";
import { editorEmojiItems, toRichTextDocument } from "./rich-text-json";
import { TipTapToolbar } from "./toolbar/tiptap-toolbar";

export type TipTapEditorBaseProps = Omit<
  React.ComponentProps<"div">,
  "defaultValue" | "onChange"
> & {
  disableScroll?: boolean;
  /** Appended after the built-in extensions - collaboration, for one. */
  extensions?: Extensions;
  /**
   * Hears the editor instance once it exists, and `null` when it goes away -
   * for code that drives the editor with commands.
   */
  onEditor?: (editor: Editor | null) => void;
  placeholder?: string;
  /**
   * Keep the editor's own undo history. `false` when something else owns it:
   * Yjs keeps a per-user history of a shared document.
   */
  undoRedo?: boolean;
};

export type TipTapEditorHtmlProps = TipTapEditorBaseProps & {
  /** HTML in, HTML out. The default. */
  format?: "html";
  onChange?: (value: string) => void;
  value?: string;
};

export type TipTapEditorJsonProps = TipTapEditorBaseProps & {
  /** A ProseMirror document in, a ProseMirror document out. */
  format: "json";
  onChange?: (value: RichTextDocument) => void;
  value?: null | RichTextDocument;
};

export type TipTapEditorProps = TipTapEditorHtmlProps | TipTapEditorJsonProps;

const textboxAttributesOf = ({
  describedBy,
  invalid,
  labelledBy,
}: {
  describedBy?: string;
  invalid?: React.AriaAttributes["aria-invalid"];
  labelledBy?: string;
}): Record<string, string> => ({
  ...(labelledBy ? { "aria-labelledby": labelledBy } : {}),
  ...(describedBy ? { "aria-describedby": describedBy } : {}),
  ...(invalid === true || invalid === "true" ? { "aria-invalid": "true" } : {}),
});

export const TipTapEditor = (props: TipTapEditorProps) => {
  const {
    "aria-describedby": describedBy,
    "aria-labelledby": labelledBy,
    className,
    disableScroll,
    extensions,
    format: _format,
    placeholder,
    undoRedo,
    value: _value,
    onChange: _onChange,
    onBlur,
    onEditor,
    ...rest
  } = props;
  const t = useTranslations("core.global.editor");
  const { emojis } = useEditorConfig();
  const emojiItems = React.useMemo(() => editorEmojiItems(emojis), [emojis]);
  const editor = useEditor({
    extensions: [
      ...createTipTapExtensions({
        customEmojis: emojis,
        placeholder: placeholder ?? t("placeholder"),
        undoRedo,
      }),
      ...(extensions ?? []),
    ],
    editorProps: {
      attributes: {
        class:
          "max-w-full min-h-40 py-4 ps-10 pe-4 text-base focus:outline-none md:text-sm",
        role: "textbox",
        "aria-multiline": "true",
        ...textboxAttributesOf({
          describedBy,
          invalid: rest["aria-invalid"],
          labelledBy,
        }),
      },
    },
    content:
      props.format === "json" ? (props.value ?? null) : (props.value ?? ""),
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      if (props.format === "json") {
        props.onChange?.(
          toRichTextDocument(currentEditor.getJSON(), emojiItems),
        );

        return;
      }

      props.onChange?.(currentEditor.getHTML());
    },
  });

  const announceEditor = React.useEffectEvent((next: Editor | null) => {
    onEditor?.(next);
  });
  React.useEffect(() => {
    if (!editor) return;
    announceEditor(editor);

    return () => {
      announceEditor(null);
    };
  }, [editor]);

  if (!editor) return <EditorSkeleton className={className} />;

  return (
    <div
      className={cn(
        "bg-card focus-within:border-ring focus-within:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 ease-fluid relative w-full rounded-md border shadow-xs transition-[border-color,box-shadow] duration-150 focus-within:ring-3 aria-invalid:ring-3 motion-reduce:transition-none",
        { "max-h-80 overflow-hidden overflow-y-auto": !disableScroll },
        className,
      )}
      onBlur={onBlur}
      {...rest}
    >
      <TipTapToolbar editor={editor} />
      <TipTapDragHandle editor={editor} />
      <EditorContent
        className="w-full min-w-full cursor-text"
        editor={editor}
      />
    </div>
  );
};
