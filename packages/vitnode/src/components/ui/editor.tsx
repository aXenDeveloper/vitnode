"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import React from "react";

import { tiptapExtensions } from "@/components/tiptap/extension";
import { TipTapToolbar } from "@/components/tiptap/toolbar/tiptap-toolbar";
import { cn } from "@/lib/utils";

import { Loader } from "./loader";

type EditorProps = Omit<React.ComponentProps<"div">, "onChange"> & {
  disableScroll?: boolean;
  onChange?: (value: string) => void;
  value?: string;
};

const TipTapEditor = ({
  className,
  disableScroll,
  value = "",
  onChange,
  onBlur,
  ...props
}: EditorProps) => {
  const editor = useEditor({
    extensions: tiptapExtensions,
    editorProps: {
      attributes: {
        class: "max-w-full focus:outline-none p-6",
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
        "bg-card relative w-full rounded-md border shadow-xs",
        { "max-h-80 overflow-hidden overflow-y-scroll": !disableScroll },
        className,
      )}
      onBlur={onBlur}
      {...props}
    >
      <TipTapToolbar editor={editor} />
      <EditorContent
        className="w-full min-w-full cursor-text"
        editor={editor}
      />
    </div>
  );
};

const subscribeNever = () => () => {};
const getIsHydrated = () => true;
const getIsHydratedOnServer = () => false;

/**
 * `useEditor` tags every instance with an id derived from `Math.random()` as it
 * renders, and a prerender cannot evaluate that - Next refuses to bake an
 * unstable value into a route's static shell. `immediatelyRender: false` means
 * the editor has no instance on the server anyway, so hold the hook back until
 * the browser has hydrated and let the shell keep the loader.
 */
export const Editor = (props: EditorProps) => {
  const isHydrated = React.useSyncExternalStore(
    subscribeNever,
    getIsHydrated,
    getIsHydratedOnServer,
  );

  if (!isHydrated) return <Loader />;

  return <TipTapEditor {...props} />;
};
