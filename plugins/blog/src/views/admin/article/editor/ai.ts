import type { EditorEmojiSection } from "@vitnode/core/components/editor-provider";
import type { RichTextDocument } from "@vitnode/core/content/rich-text";

import {
  AiRequestError,
  requestAiAssist,
} from "@vitnode/core/lib/ai/assist-client";
import { fetcher } from "@vitnode/core/tanstack/fetcher";

import { CONFIG_PLUGIN } from "@/const";

import { articleContentFromHtml } from "./content-html";

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
    plugin: CONFIG_PLUGIN.pluginId,
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
    plugin: CONFIG_PLUGIN.pluginId,
    method: "post",
    module: "admin/ai",
    path: "/translate",
    args: { body: { document, format: "richText", from, to } },
  });
  if (response.status !== 200) throw new ArticleAiError(response.status);

  const { text } = await response.json();

  return articleContentFromHtml(text, { customEmojis });
};

export const writeArticleExcerpt = async (input: {
  content: RichTextDocument;
  locale: string;
  title: string;
}): Promise<string> => {
  try {
    const { output } = await requestAiAssist({
      action: `${CONFIG_PLUGIN.pluginId}:excerpt.generate`,
      input,
    });
    if (typeof output !== "string") throw new ArticleAiError(502);

    return output;
  } catch (error) {
    if (error instanceof AiRequestError) {
      throw new ArticleAiError(
        error.code === "AI_NOT_CONFIGURED" ? 400 : error.status,
      );
    }
    throw error;
  }
};
