import React from "react";

import type { CollaborativeEditorProps } from "@/components/tiptap/collaboration";

import { EditorSkeleton } from "@/components/tiptap/editor-skeleton";

import { useContentLive } from "./context";

const ContentLiveRichTextEditor = React.lazy(async () =>
  import("./collaborative-editor").then(module => ({
    default: module.ContentLiveRichTextEditor,
  })),
);

export const ContentLiveRichTextFieldContext = React.createContext<
  null | string
>(null);

const ContentLiveCollaborativeEditor = (props: CollaborativeEditorProps) => {
  const live = useContentLive();
  const field = React.use(ContentLiveRichTextFieldContext);
  if (!live || field === null) return null;

  return (
    <React.Suspense fallback={<EditorSkeleton className={props.className} />}>
      <ContentLiveRichTextEditor field={field} live={live} {...props} />
    </React.Suspense>
  );
};

export const renderContentLiveCollaborativeEditor = (
  props: CollaborativeEditorProps,
): React.ReactNode => <ContentLiveCollaborativeEditor {...props} />;
