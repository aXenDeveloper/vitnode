import {
  AiRequestError,
  requestAiAssist,
} from "@vitnode/core/lib/ai/assist-client";
import { fetcher } from "@vitnode/core/tanstack/fetcher";

import { CONFIG_PLUGIN } from "@/const";

export class ArticleAiError extends Error {
  constructor(status: number) {
    super(`The AI request failed with status ${status}.`);
    this.name = "ArticleAiError";
    this.status = status;
  }

  readonly status: number;
}

export const translateArticleText = async (body: {
  format: "html" | "text";
  from: string;
  text: string;
  to: string;
}): Promise<string> => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "post",
    module: "admin/ai",
    path: "/translate",
    args: { body },
  });
  if (response.status !== 200) throw new ArticleAiError(response.status);

  const { text } = await response.json();

  return text;
};

/**
 * Writes an excerpt through Core's shared AI assist route - the same action
 * and mechanism the generic `ai` field option uses, so limits, history and
 * accounting are identical wherever the button is.
 */
export const writeArticleExcerpt = async (input: {
  content: string;
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
