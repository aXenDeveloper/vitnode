import React from "react";

import type { RichTextDocument } from "@/content/rich-text/document";

import type { TipTapEditorBaseProps } from "./tiptap-editor";

/** What a JSON editor hands the collaborative editor that replaces it. */
export type CollaborativeEditorProps = TipTapEditorBaseProps & {
  /** The language shown, `null` for a field that is not localized. */
  locale: null | string;
  onChange: (value: RichTextDocument) => void;
  /** The form's value: what an empty shared document is filled from. */
  value: null | RichTextDocument;
};

/**
 * Set by a live form around a co-edited rich text field: the JSON editor then
 * renders what this returns instead of its own, uncontrolled editor. `null`
 * everywhere else, which keeps the collaboration code out of every other
 * bundle.
 */
export const EditorCollaborationContext = React.createContext<
  ((props: CollaborativeEditorProps) => React.ReactNode) | null
>(null);

/**
 * Renders the collaborative editor of {@link EditorCollaborationContext} as a
 * component of its own, so it takes a `key` and the props a `FormControl`
 * adds (`id`, `aria-describedby`, `aria-invalid`).
 */
export const CollaborativeEditorSlot = ({
  render,
  ...props
}: CollaborativeEditorProps & {
  render: (props: CollaborativeEditorProps) => React.ReactNode;
}): React.JSX.Element =>
  // Wrapped in an element rather than returned as is: `ReactNode` includes a
  // promise, and an async component suspends on a new promise every render.
  React.createElement(React.Fragment, null, render(props));
