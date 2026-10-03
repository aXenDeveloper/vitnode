/**
 * What a configured language model can do, declared in the API config. Never
 * inferred from a model's name: a model whose entry says nothing is treated as
 * text-only, so nothing ever sends an image to a model nobody said accepts one.
 *
 * - `text` - text in, text out.
 * - `image-input` - accepts images in the prompt (vision). Image ALT text needs
 *   this. It is *not* image generation, which is `imageModels`.
 * - `structured-output` - reliable JSON/object output (`Output.object`).
 * - `streaming` - token streaming for `streamText`.
 */
export const AI_MODEL_CAPABILITIES = [
  "text",
  "image-input",
  "structured-output",
  "streaming",
] as const;

export type AiModelCapability = (typeof AI_MODEL_CAPABILITIES)[number];

/** Used when a model entry declares no `capabilities`. */
export const DEFAULT_AI_MODEL_CAPABILITIES: readonly AiModelCapability[] = [
  "text",
];

export const isAiModelCapability = (
  value: string,
): value is AiModelCapability =>
  (AI_MODEL_CAPABILITIES as readonly string[]).includes(value);

export const missingCapabilities = (
  required: readonly AiModelCapability[],
  available: readonly AiModelCapability[],
): AiModelCapability[] =>
  required.filter(capability => !available.includes(capability));
