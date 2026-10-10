import type { RichTextNode } from "./document";

const PLAIN_TEXT_MAX_DEPTH = 256;

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
      const label = node.attrs?.label;

      return typeof label === "string" ? label : "";
    }
  }
};

const textOf = (node: RichTextNode, depth: number): string => {
  if (depth > PLAIN_TEXT_MAX_DEPTH) return "";

  const content = Array.isArray(node.content) ? node.content : [];
  if (content.length === 0) return inlineText(node);

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

export const richTextToPlainText = (
  doc: null | RichTextNode | undefined,
): string => {
  if (!doc || typeof doc !== "object") return "";

  return textOf(doc, 0).trim();
};
