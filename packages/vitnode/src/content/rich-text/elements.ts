import type { RichTextAttrs, RichTextMark, RichTextNode } from "./document";

import { richTextToPlainText } from "./plain-text";

/**
 * The renderer-neutral description of one node or mark: a tag, attributes,
 * inline styles and children, where {@link RICH_TEXT_SLOT} marks the place the
 * node's own content goes.
 *
 * Both renderers - React and the HTML string - walk the same description, so
 * a value that is refused here is refused everywhere. Attribute names are the
 * HTML ones (`class`, `colspan`); styles are camelCase, as React wants them.
 */
export const RICH_TEXT_SLOT = 0;

export type RichTextElementAttrValue = boolean | number | string;

export interface RichTextElement {
  attrs?: Record<string, RichTextElementAttrValue>;
  children?: RichTextElementChild[];
  style?: Record<string, string>;
  tag: string;
}

export type RichTextElementChild =
  | RichTextElement
  | string
  | typeof RICH_TEXT_SLOT;

/** Tags that can never have children. */
export const RICH_TEXT_VOID_TAGS: ReadonlySet<string> = new Set([
  "audio",
  "br",
  "col",
  "hr",
  "img",
  "input",
]);

// ---------------------------------------------------------------------------
// Allowlists
// ---------------------------------------------------------------------------

const SAFE_PROTOCOLS: ReadonlySet<string> = new Set([
  "http:",
  "https:",
  "mailto:",
  "tel:",
]);

// Control characters and whitespace are what browsers skip when they read a
// scheme, so `java\tscript:` is still `javascript:` to them.
// eslint-disable-next-line no-control-regex
const IGNORED_IN_SCHEME = /[\u0000- \u007F-\u009F]/g;

/**
 * A link target that is safe to put in `href`: `http:`, `https:`, `mailto:`,
 * `tel:`, a relative path or a fragment. Anything else - `javascript:`,
 * `data:`, `vbscript:` - is `null`.
 */
export const sanitizeRichTextHref = (value: unknown): null | string => {
  if (typeof value !== "string") return null;

  const href = value.trim();
  if (href === "") return null;

  const compact = href.replace(IGNORED_IN_SCHEME, "");
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact)?.[1];
  if (scheme === undefined) {
    // Protocol-relative `//host` is an absolute URL in disguise; it is fine,
    // because it inherits `http:` or `https:` from the page.
    return href;
  }

  return SAFE_PROTOCOLS.has(`${scheme.toLowerCase()}:`) ? href : null;
};

/** A media source: `http:`, `https:` or relative. Never `data:` or `blob:`. */
export const sanitizeRichTextSrc = (value: unknown): null | string => {
  const href = sanitizeRichTextHref(value);
  if (href === null) return null;

  return /^(?:mailto|tel):/i.test(href) ? null : href;
};

const CSS_COLOR =
  /^(?:#[0-9a-f]{3,8}|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\([\d\s.,%/+a-z-]*\)|[a-z]{3,32})$/i;

const CSS_FONT_SIZE = /^\d{1,3}(?:\.\d{1,3})?(?:px|em|rem|%|pt)$/;

const TEXT_ALIGNS: ReadonlySet<string> = new Set([
  "center",
  "end",
  "justify",
  "left",
  "right",
  "start",
]);

export const sanitizeRichTextColor = (value: unknown): null | string =>
  typeof value === "string" && CSS_COLOR.test(value.trim())
    ? value.trim()
    : null;

export const sanitizeRichTextFontSize = (value: unknown): null | string =>
  typeof value === "string" && CSS_FONT_SIZE.test(value.trim())
    ? value.trim()
    : null;

export const sanitizeRichTextAlign = (value: unknown): null | string =>
  typeof value === "string" && TEXT_ALIGNS.has(value) ? value : null;

const PANEL_KINDS: ReadonlySet<string> = new Set([
  "error",
  "info",
  "success",
  "warning",
]);

const CODE_LANGUAGE = /^[a-z0-9][\w#+.-]{0,31}$/i;

const HEADING_LEVELS: ReadonlySet<number> = new Set([1, 2, 3, 4, 5, 6]);

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

const positiveInteger = (value: unknown): null | number =>
  typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;

const alignStyle = (
  attrs: RichTextAttrs | undefined,
): Record<string, string> | undefined => {
  const align = sanitizeRichTextAlign(attrs?.textAlign);

  return align === null ? undefined : { textAlign: align };
};

const withStyle = (
  element: RichTextElement,
  style: Record<string, string> | undefined,
): RichTextElement => (style ? { ...element, style } : element);

const cellElement = (tag: "td" | "th", node: RichTextNode): RichTextElement => {
  const attrs: Record<string, RichTextElementAttrValue> = {};
  const colspan = positiveInteger(node.attrs?.colspan);
  const rowspan = positiveInteger(node.attrs?.rowspan);
  if (colspan !== null && colspan > 1) attrs.colspan = colspan;
  if (rowspan !== null && rowspan > 1) attrs.rowspan = rowspan;

  return { attrs, children: [RICH_TEXT_SLOT], tag };
};

const columnWidths = (table: RichTextNode): (null | number)[] => {
  const firstRow = table.content?.[0];
  const widths: (null | number)[] = [];

  for (const cell of firstRow?.content ?? []) {
    const colspan = positiveInteger(cell.attrs?.colspan) ?? 1;
    const colwidth = Array.isArray(cell.attrs?.colwidth)
      ? cell.attrs.colwidth
      : [];

    for (let index = 0; index < colspan; index += 1) {
      widths.push(positiveInteger(colwidth[index]));
    }
  }

  return widths;
};

const tableElement = (node: RichTextNode): RichTextElement => {
  const widths = columnWidths(node);
  const sized = widths.some(width => width !== null);

  return {
    attrs: { class: "tableWrapper" },
    children: [
      {
        children: [
          ...(sized
            ? [
                {
                  children: widths.map((width): RichTextElement =>
                    width === null
                      ? { tag: "col" }
                      : { style: { width: `${width}px` }, tag: "col" },
                  ),
                  tag: "colgroup",
                },
              ]
            : []),
          { children: [RICH_TEXT_SLOT], tag: "tbody" },
        ],
        tag: "table",
      },
    ],
    tag: "div",
  };
};

const taskItemElement = (node: RichTextNode): RichTextElement => {
  const checked = node.attrs?.checked === true;
  const label = richTextToPlainText({ content: node.content, type: "doc" })
    .replace(/\s+/g, " ")
    .slice(0, 200);

  return {
    attrs: {
      "data-checked": checked ? "true" : "false",
      "data-type": "taskItem",
    },
    children: [
      {
        children: [
          {
            attrs: {
              ...(label === "" ? {} : { "aria-label": label }),
              checked,
              disabled: true,
              type: "checkbox",
            },
            tag: "input",
          },
          { tag: "span" },
        ],
        tag: "label",
      },
      { children: [RICH_TEXT_SLOT], tag: "div" },
    ],
    tag: "li",
  };
};

const emojiElement = (node: RichTextNode): RichTextElement => {
  const name = typeof node.attrs?.name === "string" ? node.attrs.name : "";
  const glyph = typeof node.attrs?.emoji === "string" ? node.attrs.emoji : "";
  const src = sanitizeRichTextSrc(node.attrs?.src);
  const attrs = {
    "data-type": "emoji",
    ...(name === "" ? {} : { "data-name": name }),
  };

  if (glyph !== "") return { attrs, children: [glyph], tag: "span" };

  if (src !== null) {
    return {
      attrs,
      children: [
        {
          attrs: { alt: `:${name}:`, draggable: "false", loading: "lazy", src },
          tag: "img",
        },
      ],
      tag: "span",
    };
  }

  return { attrs, children: [name === "" ? "" : `:${name}:`], tag: "span" };
};

/**
 * The element a node renders as, or `null` for a node this renderer does not
 * know - which then renders its children and nothing else.
 */
export const richTextNodeElement = (
  node: RichTextNode,
): null | RichTextElement => {
  switch (node.type) {
    case "audio": {
      const src = sanitizeRichTextSrc(node.attrs?.src);
      if (src === null) return null;

      return {
        attrs: {
          class: "tiptap-audio",
          controls: true,
          preload: "metadata",
          src,
        },
        tag: "audio",
      };
    }
    case "blockquote":
      return { children: [RICH_TEXT_SLOT], tag: "blockquote" };
    case "bulletList":
      return {
        attrs: { class: "list-disc" },
        children: [RICH_TEXT_SLOT],
        tag: "ul",
      };
    case "codeBlock": {
      const language = node.attrs?.language;

      return {
        children: [
          {
            attrs:
              typeof language === "string" && CODE_LANGUAGE.test(language)
                ? { class: `language-${language}` }
                : {},
            children: [RICH_TEXT_SLOT],
            tag: "code",
          },
        ],
        tag: "pre",
      };
    }
    case "doc":
      return null;
    case "emoji":
      return emojiElement(node);
    case "hardBreak":
      return { tag: "br" };
    case "heading": {
      const level = node.attrs?.level;
      const tag =
        typeof level === "number" && HEADING_LEVELS.has(level)
          ? `h${level}`
          : "h2";

      return withStyle(
        { children: [RICH_TEXT_SLOT], tag },
        alignStyle(node.attrs),
      );
    }
    case "horizontalRule":
      return { tag: "hr" };
    case "listItem":
      return { children: [RICH_TEXT_SLOT], tag: "li" };
    case "orderedList": {
      const start = positiveInteger(node.attrs?.start);

      return {
        attrs: {
          class: "list-decimal",
          ...(start !== null && start !== 1 ? { start } : {}),
        },
        children: [RICH_TEXT_SLOT],
        tag: "ol",
      };
    }
    case "panel": {
      const kind = node.attrs?.kind;

      return {
        attrs: {
          class: "tiptap-panel",
          "data-panel":
            typeof kind === "string" && PANEL_KINDS.has(kind) ? kind : "info",
        },
        children: [RICH_TEXT_SLOT],
        tag: "div",
      };
    }
    case "paragraph":
      return withStyle(
        { children: [RICH_TEXT_SLOT], tag: "p" },
        alignStyle(node.attrs),
      );
    case "table":
      return tableElement(node);
    case "tableCell":
      return cellElement("td", node);
    case "tableHeader":
      return cellElement("th", node);
    case "tableRow":
      return { children: [RICH_TEXT_SLOT], tag: "tr" };
    case "taskItem":
      return taskItemElement(node);
    case "taskList":
      return {
        attrs: { "data-type": "taskList" },
        children: [RICH_TEXT_SLOT],
        tag: "ul",
      };
    default:
      return null;
  }
};

// ---------------------------------------------------------------------------
// Marks
// ---------------------------------------------------------------------------

const SIMPLE_MARKS: Readonly<Record<string, string>> = {
  bold: "strong",
  code: "code",
  italic: "em",
  strike: "s",
  subscript: "sub",
  superscript: "sup",
  underline: "u",
};

/**
 * The element a mark wraps its text in, or `null` - for an unknown mark, and
 * for a link whose target was refused - which leaves the text as it is.
 */
export const richTextMarkElement = (
  mark: RichTextMark,
): null | RichTextElement => {
  const simple = SIMPLE_MARKS[mark.type];
  if (simple !== undefined) return { children: [RICH_TEXT_SLOT], tag: simple };

  if (mark.type === "link") {
    const href = sanitizeRichTextHref(mark.attrs?.href);
    if (href === null) return null;

    const target = mark.attrs?.target;

    return {
      attrs:
        typeof target === "string" && target !== ""
          ? { href, rel: "noopener noreferrer nofollow", target: "_blank" }
          : { href },
      children: [RICH_TEXT_SLOT],
      tag: "a",
    };
  }

  if (mark.type === "textStyle") {
    const color = sanitizeRichTextColor(mark.attrs?.color);
    const fontSize = sanitizeRichTextFontSize(mark.attrs?.fontSize);
    if (color === null && fontSize === null) return null;

    return {
      children: [RICH_TEXT_SLOT],
      style: {
        ...(color === null ? {} : { color }),
        ...(fontSize === null ? {} : { fontSize }),
      },
      tag: "span",
    };
  }

  return null;
};
