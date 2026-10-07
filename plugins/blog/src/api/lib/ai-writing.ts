import type { LanguageModel } from "ai";

import { htmlToText } from "@vitnode/core/lib/strip-html";
import { generateText } from "ai";

export type AiTextFormat = "html" | "text";

export const EXCERPT_RECOMMENDED_LENGTH = 160;

const languageName = (locale: string) => {
  try {
    return (
      new Intl.DisplayNames(["en"], { type: "language" }).of(locale) ?? locale
    );
  } catch {
    return locale;
  }
};

const unquote = (text: string) =>
  text
    .trim()
    .replace(/^["“„'](.*)["”'"]$/su, "$1")
    .trim();

export const translateWithAi = async ({
  format,
  from,
  model,
  text,
  to,
}: {
  format: AiTextFormat;
  from: string;
  model: LanguageModel;
  text: string;
  to: string;
}): Promise<string> => {
  const { text: output } = await generateText({
    model,
    temperature: 0,
    system: [
      "You translate fields of a blog article for a content management system.",
      `Translate from ${languageName(from)} into ${languageName(to)}.`,
      format === "html"
        ? "The input is HTML. Keep every tag, attribute and the document structure exactly as they are, and translate only the human-readable text."
        : "The input is plain text. Answer with plain text only.",
      "Keep product names, code, URLs and numbers unchanged.",
      "Answer with the translation only, without quotes, notes or explanations.",
    ].join("\n"),
    prompt: text,
  });

  return format === "html" ? output.trim() : unquote(output);
};

export const writeExcerptWithAi = async ({
  content,
  locale,
  model,
  title,
}: {
  content: string;
  locale: string;
  model: LanguageModel;
  title: string;
}): Promise<string> => {
  const { text } = await generateText({
    model,
    temperature: 0.3,
    system: [
      "You write the excerpt of a blog article: one or two sentences shown on the blog list and as the search result description.",
      `Write it in ${languageName(locale)}.`,
      `Keep it under ${EXCERPT_RECOMMENDED_LENGTH} characters.`,
      "Make it specific to the article, never generic, and do not start with the title.",
      "Answer with the excerpt only, without quotes, notes or explanations.",
    ].join("\n"),
    prompt: `Title: ${title}\n\nArticle:\n${htmlToText(content).slice(0, 12_000)}`,
  });

  return unquote(text);
};
