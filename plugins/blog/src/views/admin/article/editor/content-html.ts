import type { EditorEmojiSection } from "@vitnode/core/components/editor-provider";
import type { RichTextDocument } from "@vitnode/core/content/rich-text";

import { richTextDocumentFromHtml } from "@vitnode/core/components/tiptap/rich-text-json";

/**
 * The one place translated HTML becomes article content. The document it
 * returns is written by the editor layout: through the shared editor when the
 * article is co-edited (so it reaches every open editor), into the form value
 * otherwise.
 */
export const articleContentFromHtml = (
  html: string,
  { customEmojis }: { customEmojis?: EditorEmojiSection[] } = {},
): RichTextDocument => richTextDocumentFromHtml(html, { customEmojis });
