"use client";

import { EditorContent, useEditor } from "@tiptap/react";

import { tiptapExtensions } from "@/components/tiptap/extension";
import { TipTapToolbar } from "@/components/tiptap/toolbar/tiptap-toolbar";
import { cn } from "@/lib/utils";

import { Loader } from "./loader";

export const Editor = ({
  className,
  disableScroll,
  value = "",
}: {
  className?: string;
  disableScroll?: boolean;
  value?: string;
}) => {
  const editor = useEditor({
    extensions: tiptapExtensions,
    editorProps: {
      attributes: {
        class: "max-w-full focus:outline-none p-6",
      },
    },
    content: value,
    immediatelyRender: false,
  });

  if (!editor) return <Loader />;

  return (
    <div
      className={cn("bg-card relative w-full rounded-md border shadow-xs", {
        "max-h-80 overflow-hidden overflow-y-scroll": !disableScroll,
        className,
      })}
    >
      <TipTapToolbar editor={editor} />
      <EditorContent
        className="w-full min-w-full cursor-text"
        editor={editor}
      />
    </div>
  );
};
