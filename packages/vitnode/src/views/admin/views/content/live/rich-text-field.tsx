import React from "react";

import type { CollaborativeEditorProps } from "@/components/tiptap/collaboration";

import { EditorSkeleton } from "@/components/tiptap/editor-skeleton";

import { useContentLive } from "./context";

// Yjs, the collaboration extensions and the editor itself: only a co-edited
// rich text field downloads them.
const ContentLiveRichTextEditor = React.lazy(async () =>
  import("./collaborative-editor").then(module => ({
    default: module.ContentLiveRichTextEditor,
  })),
);

/** The rich text field a co-edited editor belongs to. */
export const ContentLiveRichTextFieldContext = React.createContext<
  null | string
>(null);

/**
 * What a live form puts in `EditorCollaborationContext` around a co-edited
 * rich text field: the shared editor of the field in the language shown.
 */
export const ContentLiveCollaborativeEditor = (
  props: CollaborativeEditorProps,
) => {
  const live = useContentLive();
  const field = React.use(ContentLiveRichTextFieldContext);
  if (!live || field === null) return null;

  return (
    <React.Suspense fallback={<EditorSkeleton className={props.className} />}>
      <ContentLiveRichTextEditor field={field} live={live} {...props} />
    </React.Suspense>
  );
};

/** The `EditorCollaborationContext` value of a co-edited rich text field. */
export const renderContentLiveCollaborativeEditor = (
  props: CollaborativeEditorProps,
): React.ReactNode => <ContentLiveCollaborativeEditor {...props} />;
