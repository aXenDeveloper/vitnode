import type { AiPrompt } from "@vitnode/core/api/lib/ai/action";

import { languageName } from "@vitnode/core/api/lib/ai/language-name";

export type AiTextFormat = "html" | "text";

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
