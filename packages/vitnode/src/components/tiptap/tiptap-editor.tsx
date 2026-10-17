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
  extensions?: Extensions;
  onEditor?: (editor: Editor | null) => void;
  placeholder?: string;
  undoRedo?: boolean;
};

export type TipTapEditorHtmlProps = TipTapEditorBaseProps & {
  format?: "html";
  onChange?: (value: string) => void;
  value?: string;
};

export type TipTapEditorJsonProps = TipTapEditorBaseProps & {
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

// Serializing the whole document on every transaction is the expensive part of
// typing in a long post, so the value is handed up at most this often. Blur,
// the form's submit, Escape and unmount flush it, so nothing typed is lost.
const ON_CHANGE_DELAY_MS = 200;

const EDITOR_CLASS =
  "max-w-full min-h-40 py-4 ps-5 pe-4 text-base focus:outline-none md:text-sm";

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
    onKeyDownCapture,
    ...rest
  } = props;
  const t = useTranslations("core.global.editor");
  const { emojis } = useEditorConfig();
  const emojiItems = React.useMemo(() => editorEmojiItems(emojis), [emojis]);
  const placeholderText = placeholder ?? t("placeholder");
  const invalid = rest["aria-invalid"];

  // Stable options keep `useEditor` from calling `setOptions` on every render.
  const allExtensions = React.useMemo(
    () => [
      ...createTipTapExtensions({
        customEmojis: emojis,
        placeholder: placeholderText,
        undoRedo,
      }),
      ...(extensions ?? []),
    ],
    [emojis, extensions, placeholderText, undoRedo],
  );
  const editorProps = React.useMemo(
    () => ({
      attributes: {
        class: EDITOR_CLASS,
        role: "textbox",
        "aria-multiline": "true",
        ...textboxAttributesOf({ describedBy, invalid, labelledBy }),
      },
    }),
    [describedBy, invalid, labelledBy],
  );
  // The editor only reads its content when it is created; later values are
  // its own output echoed back, so they must not count as an option change.
  const [initialContent] = React.useState(() =>
    props.format === "json" ? (props.value ?? null) : (props.value ?? ""),
  );

  const pendingChangeRef = React.useRef<(() => void) | null>(null);
  const changeTimerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const flushChange = React.useCallback(() => {
    clearTimeout(changeTimerRef.current);
    const pending = pendingChangeRef.current;
    pendingChangeRef.current = null;
    pending?.();
  }, []);

  const editor = useEditor({
    extensions: allExtensions,
    editorProps,
    content: initialContent,
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      // Captures this render's `onChange`, so a flush on unmount still writes
      // to the field (or language) the text was typed into.
      pendingChangeRef.current =
        props.format === "json"
          ? () => {
              props.onChange?.(
                toRichTextDocument(currentEditor.getJSON(), emojiItems),
              );
            }
          : () => {
              props.onChange?.(currentEditor.getHTML());
            };
      clearTimeout(changeTimerRef.current);
      changeTimerRef.current = setTimeout(flushChange, ON_CHANGE_DELAY_MS);
    },
  });

  React.useEffect(() => flushChange, [flushChange]);

  React.useEffect(() => {
    if (!editor) return;
    const form = editor.view.dom.closest("form");
    if (!form) return;

    // Capture on the form itself runs before React's delegated `onSubmit`,
    // so a Mod+Enter submit straight from the editor sends the latest text.
    form.addEventListener("submit", flushChange, true);

    return () => {
      form.removeEventListener("submit", flushChange, true);
    };
  }, [editor, flushChange]);

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
      onBlur={event => {
        flushChange();
        onBlur?.(event);
      }}
      onKeyDownCapture={event => {
        // A dialog closes on Escape: hand the text up first so its
        // unsaved-changes guard sees it.
        if (event.key === "Escape") flushChange();
        onKeyDownCapture?.(event);
      }}
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
