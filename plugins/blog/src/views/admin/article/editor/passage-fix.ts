import type {
  RichTextDocument,
  RichTextNode,
} from "@vitnode/core/content/rich-text";

export interface PassageFix {
  quote: string;
  replacement: string;
}

const INLINE_ATOM = "￼";

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const passagePattern = (quote: string) =>
  new RegExp(quote.trim().split(/\s+/).map(escapeRegExp).join("\\s+"), "u");

const isTextBlock = (node: RichTextNode) =>
  node.content?.some(child => child.type === "text") ?? false;

const inlineLength = (node: RichTextNode) =>
  node.type === "text" ? (node.text ?? "").length : INLINE_ATOM.length;

const textNode = (text: string, marks: RichTextNode["marks"]): RichTextNode =>
  marks?.length ? { marks, text, type: "text" } : { text, type: "text" };

const sameMarks = (a: RichTextNode, b: RichTextNode) =>
  JSON.stringify(a.marks ?? []) === JSON.stringify(b.marks ?? []);

const mergeTextNodes = (nodes: RichTextNode[]) =>
  nodes.reduce<RichTextNode[]>((merged, node) => {
    if (node.type === "text" && !node.text) return merged;
    const last = merged.at(-1);
    if (
      last?.type === "text" &&
      node.type === "text" &&
      sameMarks(last, node)
    ) {
      merged[merged.length - 1] = textNode(
        `${last.text ?? ""}${node.text ?? ""}`,
        last.marks,
      );

      return merged;
    }
    merged.push(node);

    return merged;
  }, []);

const spliceTextBlock = (
  block: RichTextNode,
  pattern: RegExp,
  replacement: string,
): null | RichTextNode => {
  const children = block.content ?? [];
  const flat = children
    .map(child => (child.type === "text" ? (child.text ?? "") : INLINE_ATOM))
    .join("");
  const match = pattern.exec(flat);
  if (!match) return null;

  const start = match.index;
  const end = start + match[0].length;
  const next: RichTextNode[] = [];
  let offset = 0;
  let inserted = false;

  for (const child of children) {
    const childStart = offset;
    const childEnd = offset + inlineLength(child);
    offset = childEnd;

    if (childEnd <= start || childStart >= end) {
      next.push(child);
      continue;
    }

    const text = child.text ?? "";
    if (start > childStart) {
      next.push(textNode(text.slice(0, start - childStart), child.marks));
    }
    if (!inserted) {
      inserted = true;
      if (replacement) next.push(textNode(replacement, child.marks));
    }
    if (childEnd > end) {
      next.push(textNode(text.slice(end - childStart), child.marks));
    }
  }

  return { ...block, content: mergeTextNodes(next) };
};

const replaceIn = (
  node: RichTextNode,
  pattern: RegExp,
  replacement: string,
): null | RichTextNode => {
  if (isTextBlock(node)) return spliceTextBlock(node, pattern, replacement);

  const children = node.content ?? [];
  for (const [index, child] of children.entries()) {
    const replaced = replaceIn(child, pattern, replacement);
    if (!replaced) continue;

    const emptied = isTextBlock(child) && (replaced.content?.length ?? 0) === 0;
    const content = emptied
      ? children.filter((_, at) => at !== index)
      : children.map((item, at) => (at === index ? replaced : item));

    return {
      ...node,
      content:
        content.length > 0 || node.type !== "doc"
          ? content
          : [{ type: "paragraph" }],
    };
  }

  return null;
};

export const applyPassageFix = (
  document: null | RichTextDocument,
  { quote, replacement }: PassageFix,
): null | RichTextDocument => {
  if (!document || !quote.trim()) return null;

  const replaced = replaceIn(
    document,
    passagePattern(quote),
    replacement.replace(/\s*\n+\s*/g, " "),
  );

  return replaced ? { ...replaced, type: "doc" } : null;
};
