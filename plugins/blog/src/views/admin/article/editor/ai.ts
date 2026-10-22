import type { EditorEmojiSection } from "@vitnode/core/components/editor-provider";
import type { RichTextDocument } from "@vitnode/core/content/rich-text";

import { richTextDocumentFromHtml } from "@vitnode/core/components/tiptap/rich-text-json";
import { fetcher } from "@vitnode/core/tanstack/fetcher";

import { manifest } from "@/manifest.gen";

export class ArticleAiError extends Error {
  constructor(status: number) {
    super(`The AI request failed with status ${status}.`);
    this.name = "ArticleAiError";
    this.status = status;
  }

  readonly status: number;
}

export const translateArticleText = async (body: {
  from: string;
  text: string;
  to: string;
}): Promise<string> => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "post",
    module: "admin/ai",
    path: "/translate",
    args: { body: { ...body, format: "text" } },
  });
  if (response.status !== 200) throw new ArticleAiError(response.status);

  const { text } = await response.json();

  return text;
};

export const translateArticleContent = async ({
  customEmojis,
  document,
  from,
  to,
}: {
  customEmojis?: EditorEmojiSection[];
  document: RichTextDocument;
  from: string;
  to: string;
}): Promise<RichTextDocument> => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "post",
    module: "admin/ai",
    path: "/translate",
    args: { body: { document, format: "richText", from, to } },
  });
  if (response.status !== 200) throw new ArticleAiError(response.status);

  const { text } = await response.json();

  return richTextDocumentFromHtml(text, { customEmojis });
};
