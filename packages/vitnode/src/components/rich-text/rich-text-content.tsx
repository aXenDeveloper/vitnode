import { cn } from "cn";
import React from "react";

import type {
  RichTextDocument,
  RichTextMark,
  RichTextNode,
} from "@/content/rich-text/document";
import type { RichTextElement } from "@/content/rich-text/elements";

import {
  RICH_TEXT_SLOT,
  RICH_TEXT_VOID_TAGS,
  richTextMarkElement,
  richTextNodeElement,
} from "@/content/rich-text/elements";
import { richTextToHtml } from "@/content/rich-text/html";

import {
  DeletedUpload,
  isDeletedUploadNode,
  isRestrictedUploadNode,
  RestrictedUpload,
} from "./deleted-upload";

export interface RichTextNodeRendererProps {
  children?: React.ReactNode;
  node: RichTextNode;
}

export interface RichTextMarkRendererProps {
  children?: React.ReactNode;
  mark: RichTextMark;
  node: RichTextNode;
}

export type RichTextNodeRenderer = (
  props: RichTextNodeRendererProps,
) => React.ReactNode;

export type RichTextMarkRenderer = (
  props: RichTextMarkRendererProps,
) => React.ReactNode;

export interface RichTextContentProps {
  className?: string;
  /** The document to render. Nothing renders for `null` or `undefined`. */
  content: null | RichTextDocument | undefined;
  /** Custom renderers by mark type (e.g. `link`), replacing the built-in element. */
  marks?: Readonly<Record<string, RichTextMarkRenderer>>;
  /** Custom renderers by node type (e.g. `image`), receiving the rendered children. */
  nodes?: Readonly<Record<string, RichTextNodeRenderer>>;
}

interface RenderContext {
  marks?: Readonly<Record<string, RichTextMarkRenderer>>;
  nodes?: Readonly<Record<string, RichTextNodeRenderer>>;
}

const MAX_DEPTH = 256;

const REACT_PROP_NAMES: Readonly<Record<string, string>> = {
  checked: "defaultChecked",
  class: "className",
  colspan: "colSpan",
  rowspan: "rowSpan",
};

const DRAGGABLE_UPLOAD_TYPES: ReadonlySet<string> = new Set([
  "attachment",
  "image",
]);

const uploadDragProps = (node: RichTextNode): Record<string, unknown> =>
  DRAGGABLE_UPLOAD_TYPES.has(node.type) &&
  typeof node.attrs?.fileId === "number"
    ? {
        draggable: true,
        onDragStart: (event: React.DragEvent) => {
          event.dataTransfer.effectAllowed = "copy";
          event.dataTransfer.setData(
            "text/html",
            richTextToHtml({ content: [node], type: "doc" }),
          );
        },
      }
    : {};

const renderElement = (
  element: RichTextElement,
  slot: React.ReactNode,
  key?: number,
  extraProps: Record<string, unknown> = {},
): React.ReactElement => {
  const props: Record<string, unknown> = { key, ...extraProps };
  for (const [name, value] of Object.entries(element.attrs ?? {})) {
    props[REACT_PROP_NAMES[name] ?? name] = value;
  }
  if (element.style) props.style = element.style;

  if (RICH_TEXT_VOID_TAGS.has(element.tag)) {
    return React.createElement(element.tag, props);
  }

  const children: React.ReactNode[] = [];
  for (const child of element.children ?? []) {
    if (child === RICH_TEXT_SLOT) children.push(slot);
    else if (typeof child === "string") children.push(child);
    else children.push(renderElement(child, slot));
  }

  return React.createElement(element.tag, props, ...children);
};

const ownEntry = <T,>(
  record: Readonly<Record<string, T>> | undefined,
  key: string,
): T | undefined =>
  record && Object.hasOwn(record, key) ? record[key] : undefined;

const renderText = (
  node: RichTextNode,
  key: number,
  context: RenderContext,
): React.ReactElement => {
  let content: React.ReactNode = typeof node.text === "string" ? node.text : "";

  for (const mark of [...(node.marks ?? [])].reverse()) {
    const Override = ownEntry(context.marks, mark.type);
    if (Override) {
      content = (
        <Override mark={mark} node={node}>
          {content}
        </Override>
      );
      continue;
    }

    const element = richTextMarkElement(mark);
    if (element) content = renderElement(element, content);
  }

  return <React.Fragment key={key}>{content}</React.Fragment>;
};

const renderNode = (
  node: RichTextNode,
  key: number,
  context: RenderContext,
  depth: number,
): null | React.ReactElement => {
  if (depth > MAX_DEPTH || typeof node !== "object") return null;
  if (node.type === "text") return renderText(node, key, context);

  const children = Array.isArray(node.content)
    ? node.content.map((child, index) =>
        renderNode(child, index, context, depth + 1),
      )
    : null;

  const Override = ownEntry(context.nodes, node.type);
  if (Override) {
    return (
      <Override key={key} node={node}>
        {children}
      </Override>
    );
  }

  if (isDeletedUploadNode(node)) {
    return <DeletedUpload attrs={node.attrs} key={key} type={node.type} />;
  }

  if (isRestrictedUploadNode(node)) return <RestrictedUpload key={key} />;

  const element = richTextNodeElement(node);

  return element ? (
    renderElement(element, children, key, uploadDragProps(node))
  ) : (
    <React.Fragment key={key}>{children}</React.Fragment>
  );
};

/**
 * Renders a stored rich-text document as React elements, without an editor
 * and without `dangerouslySetInnerHTML`. Built-in nodes and marks map to
 * sanitised HTML elements; unknown ones render only their children unless
 * `nodes` or `marks` supplies a renderer. Universal - works in SSR.
 */
export const RichTextContent = ({
  className,
  content,
  marks,
  nodes,
}: RichTextContentProps) => {
  if (!content || typeof content !== "object") return null;

  return (
    <div className={cn("tiptap", className)}>
      {renderNode(content, 0, { marks, nodes }, 0)}
    </div>
  );
};
