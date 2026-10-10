import React from "react";

import type { RichTextDocument } from "@/content/rich-text/document";

import type { TipTapEditorBaseProps } from "./tiptap-editor";

export type CollaborativeEditorProps = TipTapEditorBaseProps & {
  locale: null | string;
  onChange: (value: RichTextDocument) => void;
  value: null | RichTextDocument;
};

export const EditorCollaborationContext = React.createContext<
  ((props: CollaborativeEditorProps) => React.ReactNode) | null
>(null);

export const CollaborativeEditorSlot = ({
  render,
  ...props
}: CollaborativeEditorProps & {
  render: (props: CollaborativeEditorProps) => React.ReactNode;
}): React.JSX.Element =>
  React.createElement(React.Fragment, null, render(props));
