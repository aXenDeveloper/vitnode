import type { AiPrompt } from "@vitnode/core/api/lib/ai/action";

import { languageName } from "@vitnode/core/api/lib/ai/language-name";
import { stripHtml } from "@vitnode/core/lib/strip-html";

export type AiTextFormat = "html" | "text";

export const EXCERPT_RECOMMENDED_LENGTH = 160;
const EXCERPT_SOURCE_CHARACTERS = 12_000;

export const unquote = (text: string) =>
  text
    .trim()
    .replace(/^["“„'](.*)["”'"]$/su, "$1")
    .trim();

const withInstructions = (lines: string[], instructions: null | string) =>
  [...lines, ...(instructions ? [instructions] : [])].join("\n");

export const buildTranslatePrompt = (
  {
    format,
    from,
    text,
    to,
  }: { format: AiTextFormat; from: string; text: string; to: string },
  instructions: null | string = null,
): AiPrompt => ({
  system: withInstructions(
    [
      "You translate fields of a blog article for a content management system.",
      `Translate from ${languageName(from)} into ${languageName(to)}.`,
      format === "html"
        ? "The input is HTML. Keep every tag, attribute and the document structure exactly as they are, and translate only the human-readable text."
        : "The input is plain text. Answer with plain text only.",
      "Keep product names, code, URLs and numbers unchanged.",
      "Answer with the translation only, without quotes, notes or explanations.",
    ],
    instructions,
  ),
  prompt: text,
});

export const excerptSource = (content: string) =>
  stripHtml(content).slice(0, EXCERPT_SOURCE_CHARACTERS);

export const buildExcerptPrompt = (
  {
    content,
    locale,
    title,
  }: { content: string; locale: string; title: string },
  instructions: null | string = null,
): AiPrompt => ({
  system: withInstructions(
    [
      "You write the excerpt of a blog article: one or two sentences shown on the blog list and as the search result description.",
      `Write it in ${languageName(locale)}.`,
      `Keep it under ${EXCERPT_RECOMMENDED_LENGTH} characters.`,
      "Make it specific to the article, never generic, and do not start with the title.",
      "Answer with the excerpt only, without quotes, notes or explanations.",
    ],
    instructions,
  ),
  prompt: `Title: ${title}\n\nArticle:\n${excerptSource(content)}`,
});
