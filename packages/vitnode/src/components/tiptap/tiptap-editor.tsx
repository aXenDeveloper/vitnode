import { EditorContent, useEditor } from "@tiptap/react";
import { cn } from "cn";
import { useTranslations } from "use-intl";

import { useEditorConfig } from "@/components/editor-provider";

import { TipTapDragHandle } from "./drag-handle";
import { EditorSkeleton } from "./editor-skeleton";
import { createTipTapExtensions } from "./extension";
import { TipTapToolbar } from "./toolbar/tiptap-toolbar";

export type TipTapEditorProps = Omit<
  React.ComponentProps<"div">,
  "onChange"
> & {
  disableScroll?: boolean;
  onChange?: (value: string) => void;
  placeholder?: string;
  value?: string;
};

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

export const TipTapEditor = ({
  "aria-describedby": describedBy,
  "aria-labelledby": labelledBy,
  className,
  disableScroll,
  placeholder,
  value = "",
  onChange,
  onBlur,
  ...props
}: TipTapEditorProps) => {
  const t = useTranslations("core.global.editor");
  const { emojis } = useEditorConfig();
  const editor = useEditor({
    extensions: createTipTapExtensions({
      customEmojis: emojis,
      placeholder: placeholder ?? t("placeholder"),
    }),
    editorProps: {
      attributes: {
        class:
          "max-w-full min-h-40 py-4 ps-10 pe-4 text-base focus:outline-none md:text-sm",
        role: "textbox",
        "aria-multiline": "true",
        ...textboxAttributesOf({
          describedBy,
          invalid: props["aria-invalid"],
          labelledBy,
        }),
      },
    },
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      onChange?.(currentEditor.getHTML());
    },
  });

  if (!editor) return <EditorSkeleton className={className} />;

  return (
    <div
      className={cn(
        "bg-card focus-within:border-ring focus-within:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 ease-fluid relative w-full rounded-md border shadow-xs transition-[border-color,box-shadow] duration-150 focus-within:ring-3 aria-invalid:ring-3 motion-reduce:transition-none",
        { "max-h-80 overflow-hidden overflow-y-auto": !disableScroll },
        className,
      )}
      onBlur={onBlur}
      {...props}
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
