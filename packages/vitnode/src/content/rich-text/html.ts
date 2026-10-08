import type { RichTextNode } from "./document";

import {
  RICH_TEXT_SLOT,
  RICH_TEXT_VOID_TAGS,
  type RichTextElement,
  type RichTextElementChild,
  richTextMarkElement,
  richTextNodeElement,
} from "./elements";

const HTML_MAX_DEPTH = 256;

const ESCAPES: Readonly<Record<string, string>> = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};

export const escapeRichTextHtml = (value: string): string =>
  value.replace(/["&'<>]/g, char => ESCAPES[char] ?? char);

const kebab = (name: string): string =>
  name.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`);

const openTag = (element: RichTextElement): string => {
  const attrs = Object.entries(element.attrs ?? {})
    .filter(([, value]) => value !== false)
    .map(([name, value]) =>
      value === true
        ? ` ${name}`
        : ` ${name}="${escapeRichTextHtml(String(value))}"`,
    )
    .join("");
  const style = Object.entries(element.style ?? {})
    .map(([name, value]) => `${kebab(name)}: ${value}`)
    .join("; ");

  return `<${element.tag}${attrs}${style === "" ? "" : ` style="${escapeRichTextHtml(style)}"`}>`;
};

const renderElement = (element: RichTextElement, slot: string): string => {
  if (RICH_TEXT_VOID_TAGS.has(element.tag)) return openTag(element);

  const inner = (element.children ?? [])
    .map((child: RichTextElementChild) => {
      if (child === RICH_TEXT_SLOT) return slot;
      if (typeof child === "string") return escapeRichTextHtml(child);

      return renderElement(child, slot);
    })
    .join("");

  return `${openTag(element)}${inner}</${element.tag}>`;
};

const renderText = (node: RichTextNode): string => {
  let html = escapeRichTextHtml(typeof node.text === "string" ? node.text : "");

  // The first mark is the outermost, as ProseMirror serializes it.
  for (const mark of [...(node.marks ?? [])].reverse()) {
    const element = richTextMarkElement(mark);
    if (element) html = renderElement(element, html);
  }

  return html;
};

const renderNode = (node: RichTextNode, depth: number): string => {
  if (depth > HTML_MAX_DEPTH || typeof node !== "object") return "";
  if (node.type === "text") return renderText(node);

  const inner = (Array.isArray(node.content) ? node.content : [])
    .map(child => renderNode(child, depth + 1))
    .join("");
  const element = richTextNodeElement(node);

  return element ? renderElement(element, inner) : inner;
};

/**
 * The document as an HTML string, for AI prompts, emails and feeds. It shares
 * the React renderer's allowlists - unsafe links and styles are dropped, every
 * text and attribute is escaped - and carries the same classes, so Tiptap can
 * parse it back and `.tiptap` styles it.
 */
export const richTextToHtml = (doc: null | RichTextNode | undefined): string =>
  doc && typeof doc === "object" ? renderNode(doc, 0) : "";
