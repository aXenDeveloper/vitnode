import React from "react";

import type { TipTapEditorProps } from "@/components/tiptap/tiptap-editor";

import { EditorSkeleton } from "@/components/tiptap/editor-skeleton";

const TipTapEditor = React.lazy(async () =>
  import("@/components/tiptap/tiptap-editor").then(module => ({
    default: module.TipTapEditor,
  })),
);

const subscribeNever = () => () => {};
const getIsHydrated = () => true;
const getIsHydratedOnServer = () => false;

/**
 * The Tiptap rich-text editor, loaded lazily and only in the browser; a
 * skeleton shows during SSR and while it loads.
 */
export const Editor = (props: TipTapEditorProps) => {
  const isHydrated = React.useSyncExternalStore(
    subscribeNever,
    getIsHydrated,
    getIsHydratedOnServer,
  );

  if (!isHydrated) return <EditorSkeleton className={props.className} />;

  return (
    <React.Suspense fallback={<EditorSkeleton className={props.className} />}>
      <TipTapEditor {...props} />
    </React.Suspense>
  );
};
