import type { RichTextNode } from "./document";

/** The node type of an `@mention` in a rich-text document. */
export const RICH_TEXT_MENTION_NODE = "mention";

/** Longest `label` a mention keeps; longer ones are cut. */
export const RICH_TEXT_MENTION_LABEL_MAX = 255;

const MENTIONS_MAX_DEPTH = 256;

/**
 * One `@mention` as stored: `id` is the member it points at, `label` (their
 * name) and `nameCode` (their URL name) are a snapshot from when it was
 * written, used until the current values load.
 */
export interface RichTextMention {
  id: number;
  label: string;
  nameCode: null | string;
}

const mentionIdOf = (value: unknown): null | number => {
  const id =
    typeof value === "string" && /^\d{1,10}$/.test(value)
      ? Number(value)
      : value;

  return typeof id === "number" &&
    Number.isInteger(id) &&
    id > 0 &&
    id <= 2_147_483_647
    ? id
    : null;
};

/**
 * Reads a mention node's attrs, or `null` when it is not a mention or points
 * at no valid member id. Never trust stored attrs elsewhere - read them here.
 */
export const richTextMentionOf = (
  node: null | RichTextNode | undefined,
): null | RichTextMention => {
  if (!node || node.type !== RICH_TEXT_MENTION_NODE) return null;

  const id = mentionIdOf(node.attrs?.id);
  if (id === null) return null;

  const label = node.attrs?.label;
  const nameCode = node.attrs?.nameCode;

  return {
    id,
    label:
      typeof label === "string" && label.trim() !== ""
        ? label.trim().slice(0, RICH_TEXT_MENTION_LABEL_MAX)
        : String(id),
    nameCode:
      typeof nameCode === "string" && nameCode !== "" && nameCode.length <= 255
        ? nameCode
        : null,
  };
};

/**
 * The path of a mentioned member's profile - the same as `userProfileHref` in
 * `@vitnode/core`.
 */
export const richTextMentionHref = (nameCode: string): string =>
  `/users/${encodeURIComponent(nameCode)}`;

/**
 * Every member mentioned in the given documents, once each, in document
 * order. Mentions with invalid attrs are skipped. Universal.
 *
 * @example
 * ```ts
 * import { richTextMentionsOf } from "@vitnode/api/content/rich-text";
 *
 * const userIds = richTextMentionsOf(post.content).map(mention => mention.id);
 * ```
 */
export const richTextMentionsOf = (
  ...docs: readonly (null | RichTextNode | undefined)[]
): RichTextMention[] => {
  const found = new Map<number, RichTextMention>();

  const walk = (node: RichTextNode, depth: number) => {
    if (depth > MENTIONS_MAX_DEPTH || typeof node !== "object") return;

    const mention = richTextMentionOf(node);
    if (mention && !found.has(mention.id)) found.set(mention.id, mention);

    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child, depth + 1);
    }
  };

  for (const doc of docs) {
    if (doc && typeof doc === "object") walk(doc, 0);
  }

  return [...found.values()];
};
