export const AI_MODEL_CAPABILITIES = [
  "text",
  "image-input",
  "structured-output",
  "streaming",
] as const;

export type AiModelCapability = (typeof AI_MODEL_CAPABILITIES)[number];

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
): AiModelCapability[] => {
  const availableSet = new Set(available);

  return required.filter(capability => !availableSet.has(capability));
};
