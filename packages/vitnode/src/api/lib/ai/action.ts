import type { ModelMessage } from "ai";
import type { Context } from "hono";
import type { z } from "zod";

import type { EnvVitNode } from "../../middlewares/global.middleware";
import type { AiModelCapability } from "./capabilities";

import { isAiModelCapability } from "./capabilities";

export type AiActorType = "system" | "user";

export interface AiResourceRef {
  id: null | number | string;
  type: string;
}

export type AiPrompt =
  | { messages: ModelMessage[]; system?: string }
  | { prompt: string; system?: string };

export interface AiPromptContext {
  instructions: null | string;
}

export interface AiAuthorizeContext<Input> {
  c: Context<EnvVitNode>;
  input: Input;
  resource: AiResourceRef | undefined;
  userId: number;
}

export interface AiPermissionDescriptor {
  defaultGranted: boolean;
  key: string;
}

export interface AiActionDefaults {
  dailyLimit: null | number;
  maxImages: number;
  maxInputCharacters: number;
  maxOutputTokens: number;
  maxRetries: number;
  maxSteps: number;
  timeoutMs: number;
}

export type AiActionOutputMode = "object" | "text";

/* eslint-disable @typescript-eslint/method-signature-style -- method
   signatures are bivariant, which keeps a typed action assignable to the
   registry's `AnyAiActionDefinition`. */
interface AiActionDefinitionBase<
  Id extends string,
  InputSchema extends z.ZodType,
  OutputSchema extends z.ZodType,
> {
  actors?: readonly AiActorType[];
  authorize?(
    context: AiAuthorizeContext<z.output<InputSchema>>,
  ): boolean | Promise<boolean>;
  buildPrompt(input: z.output<InputSchema>, context: AiPromptContext): AiPrompt;
  defaults: Partial<AiActionDefaults> &
    Pick<
      AiActionDefaults,
      "maxInputCharacters" | "maxOutputTokens" | "timeoutMs"
    >;
  description: string;
  icon?: string;
  id: Id;
  inputSchema: InputSchema;
  measureInput?(input: z.output<InputSchema>): number;
  outputSchema: OutputSchema;
  permission: AiPermissionDescriptor | string;
  promptVersion: number;
  requiredCapabilities: readonly AiModelCapability[];
  title: string;
}

export interface AiTextActionDefinition<
  Id extends string,
  InputSchema extends z.ZodType,
  OutputSchema extends z.ZodType,
> extends AiActionDefinitionBase<Id, InputSchema, OutputSchema> {
  output: "text";
  parseText(text: string, input: z.output<InputSchema>): z.input<OutputSchema>;
}

export interface AiObjectActionDefinition<
  Id extends string,
  InputSchema extends z.ZodType,
  OutputSchema extends z.ZodType,
> extends AiActionDefinitionBase<Id, InputSchema, OutputSchema> {
  output: "object";
}

/* eslint-enable @typescript-eslint/method-signature-style */

export type AiActionDefinition<
  Id extends string = string,
  InputSchema extends z.ZodType = z.ZodType,
  OutputSchema extends z.ZodType = z.ZodType,
> =
  | AiObjectActionDefinition<Id, InputSchema, OutputSchema>
  | AiTextActionDefinition<Id, InputSchema, OutputSchema>;

export type ResolvedAiActionDefinition<
  Id extends string = string,
  InputSchema extends z.ZodType = z.ZodType,
  OutputSchema extends z.ZodType = z.ZodType,
> = Omit<
  AiActionDefinition<Id, InputSchema, OutputSchema>,
  "actors" | "defaults" | "permission"
> &
  (
    | Pick<AiObjectActionDefinition<Id, InputSchema, OutputSchema>, "output">
    | Pick<
        AiTextActionDefinition<Id, InputSchema, OutputSchema>,
        "output" | "parseText"
      >
  ) & {
    actors: readonly AiActorType[];
    defaults: AiActionDefaults;
    permission: AiPermissionDescriptor;
  };

export type AnyAiActionDefinition = ResolvedAiActionDefinition;

export class AiActionDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiActionDefinitionError";
  }
}

export const AI_ACTION_LIMITS = {
  maxInputCharacters: { max: 1_000_000, min: 1 },
  maxOutputTokens: { max: 200_000, min: 1 },
  timeoutMs: { max: 600_000, min: 1_000 },
  maxRetries: { max: 3, min: 0 },
  maxSteps: { max: 10, min: 1 },
  maxImages: { max: 10, min: 0 },
  dailyLimit: { max: 100_000, min: 0 },
} as const satisfies Record<
  keyof AiActionDefaults,
  { max: number; min: number }
>;

const LOCAL_ID_PATTERN = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)*$/;
const PERMISSION_KEY_PATTERN = LOCAL_ID_PATTERN;
const ICON_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const assertInRange = (
  actionId: string,
  field: keyof AiActionDefaults,
  value: number,
) => {
  const { max, min } = AI_ACTION_LIMITS[field];
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new AiActionDefinitionError(
      `AI action "${actionId}" has an invalid default ${field}: ${value}. Use a whole number from ${min} to ${max}.`,
    );
  }
};

export function defineAiAction<
  const Id extends string,
  InputSchema extends z.ZodType,
  OutputSchema extends z.ZodType,
>(
  definition: AiActionDefinition<Id, InputSchema, OutputSchema>,
): ResolvedAiActionDefinition<Id, InputSchema, OutputSchema> {
  const { id } = definition;

  if (!LOCAL_ID_PATTERN.test(id)) {
    throw new AiActionDefinitionError(
      `AI action id "${id}" is invalid. Use lowercase dot-separated words, e.g. "excerpt.generate".`,
    );
  }

  if (!definition.title.trim() || !definition.description.trim()) {
    throw new AiActionDefinitionError(
      `AI action "${id}" needs a title and a description for the AdminCP.`,
    );
  }
  if (
    definition.icon !== undefined &&
    !ICON_NAME_PATTERN.test(definition.icon)
  ) {
    throw new AiActionDefinitionError(
      `AI action "${id}" has an invalid icon "${definition.icon}". Use a Lucide icon name in kebab case, e.g. "languages".`,
    );
  }

  if (
    !Number.isInteger(definition.promptVersion) ||
    definition.promptVersion < 1
  ) {
    throw new AiActionDefinitionError(
      `AI action "${id}" needs a whole-number promptVersion of 1 or more.`,
    );
  }

  if (definition.requiredCapabilities.length === 0) {
    throw new AiActionDefinitionError(
      `AI action "${id}" declares no requiredCapabilities. Every action needs at least "text".`,
    );
  }
  for (const capability of definition.requiredCapabilities) {
    if (!isAiModelCapability(capability)) {
      throw new AiActionDefinitionError(
        `AI action "${id}" requires the unsupported capability "${String(capability)}".`,
      );
    }
  }
  if (
    definition.output === "object" &&
    !definition.requiredCapabilities.includes("structured-output")
  ) {
    throw new AiActionDefinitionError(
      `AI action "${id}" returns an object, so it must require the "structured-output" capability.`,
    );
  }

  const permission: AiPermissionDescriptor =
    typeof definition.permission === "string"
      ? { key: definition.permission, defaultGranted: false }
      : definition.permission;
  if (!PERMISSION_KEY_PATTERN.test(permission.key)) {
    throw new AiActionDefinitionError(
      `AI action "${id}" has an invalid permission key "${permission.key}".`,
    );
  }

  const defaults: AiActionDefaults = {
    dailyLimit: null,
    maxImages: definition.requiredCapabilities.includes("image-input") ? 1 : 0,
    maxRetries: 0,
    maxSteps: 1,
    ...definition.defaults,
  };
  for (const field of Object.keys(
    AI_ACTION_LIMITS,
  ) as (keyof AiActionDefaults)[]) {
    const value = defaults[field];
    if (value === null) continue;
    assertInRange(id, field, value);
  }
  if (
    definition.requiredCapabilities.includes("image-input") &&
    defaults.maxImages < 1
  ) {
    throw new AiActionDefinitionError(
      `AI action "${id}" requires "image-input", so defaults.maxImages must be at least 1.`,
    );
  }

  const actors = definition.actors ?? ["user"];
  if (actors.length === 0) {
    throw new AiActionDefinitionError(
      `AI action "${id}" allows no actors. Use ["user"], ["system"] or both.`,
    );
  }
  if (actors.includes("user") && !definition.authorize) {
    throw new AiActionDefinitionError(
      `AI action "${id}" can run for users, so it needs an authorize() check for the content it reads.`,
    );
  }

  return {
    ...definition,
    actors,
    defaults,
    permission,
  };
}

export const countInputCharacters = (value: unknown): number => {
  if (typeof value === "string") return value.length;
  if (Array.isArray(value)) {
    return value.reduce<number>(
      (total, item) => total + countInputCharacters(item),
      0,
    );
  }
  if (value && typeof value === "object") {
    return Object.values(value).reduce<number>(
      (total, item) => total + countInputCharacters(item),
      0,
    );
  }

  return 0;
};
