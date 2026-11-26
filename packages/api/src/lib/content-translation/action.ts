import { z } from "zod";

import { manifest } from "@/manifest";

import { defineAiAction } from "../ai/action";
import { languageName } from "../ai/language-name";
import { aiActionRef } from "../ai/registry";

/** Characters of segment text one translation may send. */
export const CONTENT_TRANSLATE_MAX_INPUT = 12_000;

const zodSegment = z.object({
  id: z.string().regex(/^s\d{1,4}$/u),
  text: z.string().max(CONTENT_TRANSLATE_MAX_INPUT),
});

const inputSchema = z.object({
  blocks: z
    .array(z.object({ segments: z.array(zodSegment).min(1).max(2000) }))
    .min(1)
    .max(2000),
  sourceLocale: z.string().min(2).max(32).nullable(),
  targetLocale: z.string().min(2).max(32),
});

export type ContentTranslateAiInput = z.infer<typeof inputSchema>;

/**
 * Translates the text segments of one field of a public record into the
 * reader's language. A system action: only the translation worker runs it,
 * as the system actor, never a request.
 */
export const contentTranslateAiAction = defineAiAction({
  actors: ["system"],
  buildPrompt: (input, { instructions }) => ({
    prompt: JSON.stringify({ blocks: input.blocks }),
    system: [
      `Translate user-written community posts ${
        input.sourceLocale
          ? `from ${languageName(input.sourceLocale)}`
          : "from whatever language they are in"
      } into ${languageName(input.targetLocale)}.`,
      "The input is JSON: blocks of text segments. Segments in one block are consecutive runs of the same paragraph, so translate them together, in context, but return each segment under its own id.",
      "Return every segment id exactly once, and no other ids. Keep each segment's text in that segment, even when word order changes.",
      "Keep every placeholder like ⟦1⟧ exactly as written. They stand for links, mentions and code.",
      "Keep the author's meaning, tone and register. Do not add, explain, censor or summarize anything. Leave names, product names and code as they are.",
      "If a segment is already in the target language, return it unchanged.",
      ...(instructions ? [instructions] : []),
    ].join("\n"),
  }),
  defaults: {
    maxInputCharacters: CONTENT_TRANSLATE_MAX_INPUT,
    maxOutputTokens: 6_000,
    maxRetries: 0,
    timeoutMs: 60_000,
  },
  description: "ai_actions.@vitnode/core.content_translate.description",
  icon: "languages",
  id: "content.translate",
  title: "ai_actions.@vitnode/core.content_translate.title",
  inputSchema,
  measureInput: input =>
    input.blocks.reduce(
      (total, block) =>
        total +
        block.segments.reduce((sum, segment) => sum + segment.text.length, 0),
      0,
    ),
  output: "object",
  outputSchema: z.object({
    segments: z.array(z.object({ id: z.string(), text: z.string() })),
  }),
  permission: { defaultGranted: false, key: "content.translate" },
  promptVersion: 1,
  requiredCapabilities: ["text", "structured-output"],
});

export const CONTENT_TRANSLATE_AI_ACTION = aiActionRef(
  manifest.id,
  contentTranslateAiAction,
);
