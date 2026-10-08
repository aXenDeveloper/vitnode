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

export interface RichTextNodeRendererProps {
  /** The node's content, already rendered. */
  children?: React.ReactNode;
  node: RichTextNode;
}

export interface RichTextMarkRendererProps {
  /** The text, with every inner mark already applied. */
  children?: React.ReactNode;
  mark: RichTextMark;
  /** The text node the mark is on. */
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
  content: null | RichTextDocument | undefined;
  /** Renderers by mark type. They replace the built-in one for that type. */
  marks?: Readonly<Record<string, RichTextMarkRenderer>>;
  /** Renderers by node type. They replace the built-in one for that type. */
  nodes?: Readonly<Record<string, RichTextNodeRenderer>>;
}

interface RenderContext {
  marks?: Readonly<Record<string, RichTextMarkRenderer>>;
  nodes?: Readonly<Record<string, RichTextNodeRenderer>>;
}

const MAX_DEPTH = 256;

const REACT_PROP_NAMES: Readonly<Record<string, string>> = {
  // Uncontrolled on purpose: a task checkbox is a read-only picture of the
  // document, and a controlled `checked` with no `onChange` is a React warning.
  checked: "defaultChecked",
  class: "className",
  colspan: "colSpan",
  rowspan: "rowSpan",
};

const renderElement = (
  element: RichTextElement,
  slot: React.ReactNode,
  key?: number,
): React.ReactElement => {
  const props: Record<string, unknown> = { key };
  for (const [name, value] of Object.entries(element.attrs ?? {})) {
    props[REACT_PROP_NAMES[name] ?? name] = value;
  }
  if (element.style) props.style = element.style;

  if (RICH_TEXT_VOID_TAGS.has(element.tag)) {
    return React.createElement(element.tag, props);
  }

  // Passed as arguments rather than as one array: an element's own children
  // are a fixed shape, never a list, so they need no keys.
  const children: React.ReactNode[] = [];
  for (const child of element.children ?? []) {
    if (child === RICH_TEXT_SLOT) children.push(slot);
    else if (typeof child === "string") children.push(child);
    else children.push(renderElement(child, slot));
  }

  return React.createElement(element.tag, props, ...children);
};

const renderText = (
  node: RichTextNode,
  key: number,
  context: RenderContext,
): React.ReactElement => {
  let content: React.ReactNode = typeof node.text === "string" ? node.text : "";

  // The first mark is the outermost, as ProseMirror serializes it.
  for (const mark of [...(node.marks ?? [])].reverse()) {
    const Override = context.marks?.[mark.type];
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

  const Override = context.nodes?.[node.type];
  if (Override) {
    return (
      <Override key={key} node={node}>
        {children}
      </Override>
    );
  }

  const element = richTextNodeElement(node);

  return element ? (
    renderElement(element, children, key)
  ) : (
    <React.Fragment key={key}>{children}</React.Fragment>
  );
};

/**
 * Renders a rich text document to React - on the server and in the browser -
 * without Tiptap, ProseMirror or Yjs. Unknown nodes render their content, and
 * unknown marks render plain text. Links, media sources and styles go through
 * the same allowlists as `richTextToHtml`.
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
