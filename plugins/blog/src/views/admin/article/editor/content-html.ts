import type { EditorEmojiSection } from "@vitnode/core/components/editor-provider";
import type { RichTextDocument } from "@vitnode/core/content/rich-text";

import { richTextDocumentFromHtml } from "@vitnode/core/components/tiptap/rich-text-json";

/**
 * The one place translated HTML becomes article content. Today it replaces the
 * document; once the article is co-edited, this is where the change goes in
 * through editor commands instead, so it reaches every open editor.
 */
export const articleContentFromHtml = (
  html: string,
  { customEmojis }: { customEmojis?: EditorEmojiSection[] } = {},
): RichTextDocument => richTextDocumentFromHtml(html, { customEmojis });
