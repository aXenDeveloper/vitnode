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

export const writeArticleExcerpt = async (body: {
  content: string;
  locale: string;
  title: string;
}): Promise<string> => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "post",
    module: "admin/ai",
    path: "/excerpt",
    args: { body },
  });
  if (response.status !== 200) throw new ArticleAiError(response.status);

  const { text } = await response.json();

  return text;
};
