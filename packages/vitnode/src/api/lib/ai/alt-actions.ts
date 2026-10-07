import { z } from "zod";

import { CONFIG_PLUGIN } from "@/config";

import { defineAiAction } from "./action";
import { aiActionRef } from "./registry";

/** Image types sent to a vision model. Anything else is never analysed. */
export const ALT_IMAGE_MEDIA_TYPES = [
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** The language the image-level base description is written in. */
export const ALT_BASE_LANGUAGE = "en";

const unquote = (text: string) =>
  text
    .trim()
    .replace(/^["“„'](.*)["”'"]$/su, "$1")
    .trim();

const languageName = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
};

/**
 * Describes one image once, in English - the base every language is
 * translated from. Runs only as the system actor: there is no user whose
 * points it could spend.
 */
export const altGenerateAiAction = defineAiAction({
  actors: ["system"],
  buildPrompt: (input, { instructions }) => ({
    messages: [
      {
        content: [
          {
            text: "Write the alternative text for this image.",
            type: "text",
          },
          { data: input.image, mediaType: input.mediaType, type: "file" },
        ],
        role: "user",
      },
    ],
    system: [
      "You write alternative text (ALT) for images on a website, for people using screen readers.",
      "Describe what matters in the image concisely and accurately, usually in one sentence.",
      "Do not start with 'Image of' or 'Picture of'. Do not guess names of people. Transcribe short visible text when it matters.",
      "Write in English. Answer with the ALT text only, without quotes or notes.",
      ...(instructions ? [instructions] : []),
    ].join("\n"),
  }),
  defaults: {
    maxImages: 1,
    maxInputCharacters: 1,
    maxOutputTokens: 200,
    maxRetries: 1,
    timeoutMs: 60_000,
  },
  description: "ai_actions.@vitnode/core.alt_generate.description",
  icon: "image",
  id: "media.alt.generate",
  title: "ai_actions.@vitnode/core.alt_generate.title",
  inputSchema: z.object({
    image: z.instanceof(Uint8Array),
    mediaType: z.enum(ALT_IMAGE_MEDIA_TYPES),
  }),
  measureInput: () => 0,
  output: "text",
  outputSchema: z.string().min(1).max(500),
  parseText: text => unquote(text),
  permission: { defaultGranted: false, key: "media.alt" },
  promptVersion: 1,
  requiredCapabilities: ["text", "image-input"],
});

/** Translates a base description into one site language. */
export const altTranslateAiAction = defineAiAction({
  actors: ["system"],
  buildPrompt: (input, { instructions }) => ({
    prompt: input.text,
    system: [
      `Translate this image description (ALT text) from English into ${languageName(input.to)}.`,
      "Keep it concise and natural for a screen reader user.",
      "Answer with the translation only, without quotes or notes.",
      ...(instructions ? [instructions] : []),
    ].join("\n"),
  }),
  defaults: {
    maxInputCharacters: 1_000,
    maxOutputTokens: 300,
    maxRetries: 1,
    timeoutMs: 30_000,
  },
  description: "ai_actions.@vitnode/core.alt_translate.description",
  icon: "languages",
  id: "media.alt.translate",
  title: "ai_actions.@vitnode/core.alt_translate.title",
  inputSchema: z.object({
    text: z.string().min(1).max(1_000),
    to: z.string().min(2).max(32),
  }),
  output: "text",
  outputSchema: z.string().min(1).max(500),
  parseText: text => unquote(text),
  permission: { defaultGranted: false, key: "media.alt" },
  promptVersion: 1,
  requiredCapabilities: ["text"],
});

export const ALT_GENERATE_AI_ACTION = aiActionRef(
  CONFIG_PLUGIN.pluginId,
  altGenerateAiAction,
);
export const ALT_TRANSLATE_AI_ACTION = aiActionRef(
  CONFIG_PLUGIN.pluginId,
  altTranslateAiAction,
);
