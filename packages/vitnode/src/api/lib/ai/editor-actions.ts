import { z } from "zod";

import { CONFIG_PLUGIN } from "@/config";

import { defineAiAction } from "./action";
import { aiActionRef } from "./registry";

/** Bounds of what the editor sends: the selection and a little context. */
export const QUICK_ASK_LIMITS = {
  context: 1_500,
  instruction: 500,
  selection: 8_000,
} as const;

export const QUICK_ASK_OPERATIONS = [
  "shorten",
  "correct",
  "simplify",
  "tone",
] as const;
export const QUICK_ASK_TONES = [
  "confident",
  "formal",
  "friendly",
  "neutral",
] as const;

const languageName = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
};

const PLAIN_TEXT_RULES = [
  "Answer with plain text only: no Markdown, no HTML, no quotes, no notes.",
  "Separate paragraphs with one blank line.",
];

const contextBlock = (input: { after: string; before: string }) =>
  [
    input.before
      ? `Text before (context only, do not repeat):\n${input.before}`
      : "",
    input.after
      ? `Text after (context only, do not repeat):\n${input.after}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

const OPERATION_INSTRUCTIONS: Record<
  (typeof QUICK_ASK_OPERATIONS)[number],
  string
> = {
  correct:
    "Correct spelling, grammar and punctuation. Change nothing else - keep the wording, meaning and style.",
  shorten: "Make the text shorter and tighter while keeping its meaning.",
  simplify:
    "Rewrite the text in simpler words and shorter sentences, for a broad audience.",
  tone: "Rewrite the text in the requested tone, keeping its meaning.",
};

/**
 * The text a person typed in their own editor is the only input: nothing is
 * read from the server, so there is no content to authorize beyond being
 * signed in - and the input is bounded.
 */
const ownDraft = () => true;

/** Shorten, correct, simplify or change the tone of a selection. */
export const editorRewriteAiAction = defineAiAction({
  authorize: ownDraft,
  buildPrompt: (input, { instructions }) => ({
    prompt: [contextBlock(input), `Text to rewrite:\n${input.selection}`]
      .filter(Boolean)
      .join("\n\n"),
    system: [
      "You edit a passage of text inside a content editor.",
      OPERATION_INSTRUCTIONS[input.operation],
      ...(input.operation === "tone" && input.tone
        ? [`Tone: ${input.tone}.`]
        : []),
      `Write in ${languageName(input.locale)}.`,
      "Answer with the rewritten passage only.",
      ...PLAIN_TEXT_RULES,
      ...(instructions ? [instructions] : []),
    ].join("\n"),
  }),
  defaults: {
    maxInputCharacters:
      QUICK_ASK_LIMITS.selection + 2 * QUICK_ASK_LIMITS.context,
    maxOutputTokens: 2_000,
    timeoutMs: 60_000,
  },
  description:
    "Rewrites the selected text: shorter, corrected, simpler or in another tone.",
  id: "editor.selection.rewrite",
  inputSchema: z.object({
    after: z.string().max(QUICK_ASK_LIMITS.context),
    before: z.string().max(QUICK_ASK_LIMITS.context),
    locale: z.string().min(2).max(16),
    operation: z.enum(QUICK_ASK_OPERATIONS),
    selection: z.string().trim().min(1).max(QUICK_ASK_LIMITS.selection),
    tone: z.enum(QUICK_ASK_TONES).optional(),
  }),
  output: "text",
  outputSchema: z.string().min(1).max(40_000),
  parseText: text => text.trim(),
  permission: { defaultGranted: false, key: "editor.assist" },
  promptVersion: 1,
  requiredCapabilities: ["text"],
});

/** Continue the text, or follow a custom instruction about the selection. */
export const editorQuickAskAiAction = defineAiAction({
  authorize: ownDraft,
  buildPrompt: (input, { instructions }) => ({
    prompt: [
      contextBlock(input),
      input.selection ? `Selected text:\n${input.selection}` : "",
      input.mode === "custom" ? `Request: ${input.instruction ?? ""}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    system: [
      "You help a writer inside a content editor.",
      input.mode === "continue"
        ? "Continue the text naturally from where the context before ends, in the same style. Write one or two paragraphs."
        : "Do what the request asks with the selected text, and answer with the text to put into the document.",
      `Write in ${languageName(input.locale)}.`,
      "Never claim facts you cannot know; never invent quotes, statistics or sources.",
      ...PLAIN_TEXT_RULES,
      ...(instructions ? [instructions] : []),
    ].join("\n"),
  }),
  defaults: {
    maxInputCharacters:
      QUICK_ASK_LIMITS.selection +
      2 * QUICK_ASK_LIMITS.context +
      QUICK_ASK_LIMITS.instruction,
    maxOutputTokens: 1_500,
    timeoutMs: 60_000,
  },
  description:
    "Continues the text or follows a custom request about the selection.",
  id: "editor.quick-ask",
  inputSchema: z
    .object({
      after: z.string().max(QUICK_ASK_LIMITS.context),
      before: z.string().max(QUICK_ASK_LIMITS.context),
      instruction: z
        .string()
        .trim()
        .max(QUICK_ASK_LIMITS.instruction)
        .optional(),
      locale: z.string().min(2).max(16),
      mode: z.enum(["continue", "custom"]),
      selection: z.string().max(QUICK_ASK_LIMITS.selection),
    })
    .refine(
      input =>
        input.mode === "continue"
          ? input.before.trim().length > 0 || input.selection.trim().length > 0
          : (input.instruction ?? "").length > 0,
      "A custom request needs an instruction; continuing needs some text.",
    ),
  output: "text",
  outputSchema: z.string().min(1).max(40_000),
  parseText: text => text.trim(),
  permission: { defaultGranted: false, key: "editor.assist" },
  promptVersion: 1,
  requiredCapabilities: ["text"],
});

export const EDITOR_REWRITE_AI_ACTION = aiActionRef(
  CONFIG_PLUGIN.pluginId,
  editorRewriteAiAction,
);
export const EDITOR_QUICK_ASK_AI_ACTION = aiActionRef(
  CONFIG_PLUGIN.pluginId,
  editorQuickAskAiAction,
);
