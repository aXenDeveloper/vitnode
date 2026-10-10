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
  content: null | RichTextDocument | undefined;
  marks?: Readonly<Record<string, RichTextMarkRenderer>>;
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
