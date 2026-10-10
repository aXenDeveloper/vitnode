import type { EmojiItem } from "@tiptap/extension-emoji";
import type { JSONContent } from "@tiptap/react";

import { gitHubEmojis, shortcodeToEmoji } from "@tiptap/extension-emoji";
import { generateJSON } from "@tiptap/react";

import type { EditorEmojiSection } from "@/components/editor-provider";
import type {
  RichTextAttrPrimitive,
  RichTextAttrs,
  RichTextAttrValue,
  RichTextDocument,
  RichTextMark,
  RichTextNode,
} from "@/content/rich-text/document";

import { customEmojiToTipTap } from "./emoji/custom-emoji";
import { createTipTapExtensions } from "./extension";

const isAttrPrimitive = (value: unknown): value is RichTextAttrPrimitive =>
  value === null ||
  typeof value === "string" ||
  typeof value === "boolean" ||
  (typeof value === "number" && Number.isFinite(value));

const toAttrValue = (value: unknown): RichTextAttrValue | undefined => {
  if (isAttrPrimitive(value)) return value;
  if (Array.isArray(value) && value.every(isAttrPrimitive)) return value;

  return undefined;
};

const toAttrs = (attrs: unknown): RichTextAttrs | undefined => {
  if (typeof attrs !== "object" || attrs === null) return undefined;

  const entries = Object.entries(attrs).flatMap(([name, value]) => {
    const attrValue = toAttrValue(value);

    return attrValue === undefined ? [] : [[name, attrValue] as const];
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const withEmoji = (
  attrs: RichTextAttrs | undefined,
  emojis: EmojiItem[],
): RichTextAttrs | undefined => {
  const name = attrs?.name;
  if (typeof name !== "string") return attrs;

  const item = shortcodeToEmoji(name, emojis);
  if (item?.emoji) return { ...attrs, emoji: item.emoji };
  if (item?.fallbackImage) return { ...attrs, src: item.fallbackImage };

  return attrs;
};

const toMark = (mark: JSONContent): null | RichTextMark => {
  if (typeof mark.type !== "string") return null;

  const attrs = toAttrs(mark.attrs);

  return attrs ? { attrs, type: mark.type } : { type: mark.type };
};

const toNode = (
  json: JSONContent,
  emojis: EmojiItem[],
): null | RichTextNode => {
  if (typeof json.type !== "string") return null;

  const node: RichTextNode = { type: json.type };
  const attrs =
    json.type === "emoji"
      ? withEmoji(toAttrs(json.attrs), emojis)
      : toAttrs(json.attrs);
  if (attrs) node.attrs = attrs;

  const content = (json.content ?? []).flatMap(child => {
    const converted = toNode(child, emojis);

    return converted ? [converted] : [];
  });
  if (content.length > 0) node.content = content;

  const marks = (json.marks ?? []).flatMap(mark => {
    const converted = toMark(mark);

    return converted ? [converted] : [];
  });
  if (marks.length > 0) node.marks = marks;

  if (typeof json.text === "string") node.text = json.text;

  return node;
};

export const editorEmojiItems = (
  customEmojis?: EditorEmojiSection[],
): EmojiItem[] => [...gitHubEmojis, ...customEmojiToTipTap(customEmojis)];

export const toRichTextDocument = (
  json: JSONContent,
  emojis: EmojiItem[] = [],
): RichTextDocument => {
  const content = (json.content ?? []).flatMap(child => {
    const converted = toNode(child, emojis);

    return converted ? [converted] : [];
  });

  return content.length > 0 ? { content, type: "doc" } : { type: "doc" };
};

export const richTextDocumentFromHtml = (
  html: string,
  { customEmojis }: { customEmojis?: EditorEmojiSection[] } = {},
): RichTextDocument =>
  toRichTextDocument(
    generateJSON(html, createTipTapExtensions({ customEmojis })),
    editorEmojiItems(customEmojis),
  );
