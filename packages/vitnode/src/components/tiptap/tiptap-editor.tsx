import { EditorContent, useEditor } from "@tiptap/react";
import { cn } from "cn";
import { useTranslations } from "use-intl";

import { useEditorConfig } from "@/components/editor-provider";

import { Loader } from "../ui/loader";
import { TipTapDragHandle } from "./drag-handle";
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

export const TipTapEditor = ({
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
      },
    },
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      onChange?.(currentEditor.getHTML());
    },
  });

  if (!editor) return <Loader />;

  return (
    <div
      className={cn(
        "bg-card focus-within:border-ring focus-within:ring-ring/50 relative w-full rounded-md border shadow-xs transition-[border-color,box-shadow] duration-150 focus-within:ring-3",
        { "max-h-80 overflow-hidden overflow-y-scroll": !disableScroll },
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
