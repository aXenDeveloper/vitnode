import type { RichTextNode } from "./document";

/** Deeper than any document the schema accepts; past it, nothing is read. */
const PLAIN_TEXT_MAX_DEPTH = 256;

/** Inside one of these, child blocks sit side by side rather than stacked. */
const ROW_TYPES: ReadonlySet<string> = new Set(["tableRow"]);

const inlineText = (node: RichTextNode): string => {
  switch (node.type) {
    case "emoji": {
      const emoji = node.attrs?.emoji;
      const name = node.attrs?.name;
      if (typeof emoji === "string" && emoji !== "") return emoji;

      return typeof name === "string" && name !== "" ? `:${name}:` : "";
    }
    case "hardBreak":
      return "\n";
    case "text":
      return typeof node.text === "string" ? node.text : "";
    default: {
      // A plugin's inline atom - a mention, say - usually carries a label.
      const label = node.attrs?.label;

      return typeof label === "string" ? label : "";
    }
  }
};

const textOf = (node: RichTextNode, depth: number): string => {
  if (depth > PLAIN_TEXT_MAX_DEPTH) return "";

  const content = Array.isArray(node.content) ? node.content : [];
  if (content.length === 0) return inlineText(node);

  // A node holding any text holds inline content, so its children run on.
  // Otherwise they are blocks, one per line - or one per cell in a table row.
  if (content.some(child => child.type === "text")) {
    return content
      .map(child =>
        child.content?.length ? textOf(child, depth + 1) : inlineText(child),
      )
      .join("");
  }

  return content
    .map(child => textOf(child, depth + 1).trim())
    .filter(text => text !== "")
    .join(ROW_TYPES.has(node.type) ? " " : "\n");
};

/**
 * The words of a document, for search, SEO descriptions, excerpts and diffs.
 * Blocks are separated by a newline, table cells by a space, and the result is
 * trimmed. No markup survives, and nothing is escaped - escape it where it is
 * put into HTML.
 */
export const richTextToPlainText = (
  doc: null | RichTextNode | undefined,
): string => {
  if (!doc || typeof doc !== "object") return "";

  return textOf(doc, 0).trim();
};
