import type {
  RichTextDocument,
  RichTextNode,
} from "@vitnode/core/content/rich-text";

import { richTextToPlainText } from "@vitnode/core/content/rich-text";

const WORDS_PER_MINUTE = 220;

export interface PostHeading {
  id: string;
  level: 2 | 3;
  title: string;
}

export interface PostOutline {
  headingId: (node: RichTextNode) => string | undefined;
  headings: PostHeading[];
}

const textOf = (node: RichTextNode): string =>
  typeof node.text === "string"
    ? node.text
    : (node.content ?? []).map(textOf).join("");

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

const tocLevel = (level: unknown): 2 | 3 | null => {
  if (level === 3) return 3;
  if (level === 1 || level === 2) return 2;

  return null;
};

export const postOutline = (
  document: null | RichTextDocument | undefined,
): PostOutline => {
  const ids = new WeakMap<RichTextNode, string>();
  const used = new Map<string, number>();
  const headings: PostHeading[] = [];

  const visit = (node: RichTextNode) => {
    if (node.type === "heading") {
      const title = textOf(node).trim();
      const base = slugify(title) || "section";
      const count = (used.get(base) ?? 0) + 1;
      used.set(base, count);
      const id = count === 1 ? base : `${base}-${count}`;
      ids.set(node, id);

      const level = tocLevel(node.attrs?.level);
      if (level && title) headings.push({ id, level, title });

      return;
    }

    for (const child of node.content ?? []) visit(child);
  };

  for (const node of document?.content ?? []) visit(node);

  return { headingId: node => ids.get(node), headings };
};

export const postReadingMinutes = (
  document: null | RichTextDocument | undefined,
): number => {
  const words = richTextToPlainText(document)
    .split(/\s+/u)
    .filter(Boolean).length;

  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
};
