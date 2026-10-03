import type { ModelMessage } from "ai";
import type { Context } from "hono";
import type { z } from "zod";

import type { EnvVitNode } from "../../middlewares/global.middleware";
import type { AiModelCapability } from "./capabilities";

import { isAiModelCapability } from "./capabilities";

/** Who an AI run is for. Decided by the server, never by the request. */
export type AiActorType = "system" | "user";

export interface AiResourceRef {
  id: null | number | string;
  type: string;
}

/** What a prompt builder hands to the Vercel AI SDK. */
export type AiPrompt =
  | { messages: ModelMessage[]; system?: string }
  | { prompt: string; system?: string };

export interface AiPromptContext {
  /** Extra editorial instructions an admin set for this action, if any. */
  instructions: null | string;
}

export interface AiAuthorizeContext<Input> {
  c: Context<EnvVitNode>;
  input: Input;
  resource: AiResourceRef | undefined;
  userId: number;
}

/**
 * The permission a role needs to use the action. Several actions can share
 * one key - every Quick Ask variant needs `editor.assist`, for example.
 * `defaultGranted` is what applies while no role has a row for the key.
 */
export interface AiPermissionDescriptor {
  defaultGranted: boolean;
  key: string;
}

export interface AiActionDefaults {
  /** Optional per-user daily invocation limit; `null` for none. */
  dailyLimit: null | number;
  /** Images sent in one call - bounds the reservation of a vision action. */
  maxImages: number;
  maxInputCharacters: number;
  maxOutputTokens: number;
  /** Extra attempts after a failed provider call. */
  maxRetries: number;
  /** Model round trips per attempt (tool loops). */
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
  /** `system` actions run only from trusted server code (cron, queue). */
  actors?: readonly AiActorType[];
  /**
   * Checks the actor may touch the resource the input came from. Required for
   * user actions: an AI permission never replaces access to the content.
   */
  authorize?(
    context: AiAuthorizeContext<z.output<InputSchema>>,
  ): boolean | Promise<boolean>;
  buildPrompt(input: z.output<InputSchema>, context: AiPromptContext): AiPrompt;
  defaults: Partial<AiActionDefaults> &
    Pick<
      AiActionDefaults,
      "maxInputCharacters" | "maxOutputTokens" | "timeoutMs"
    >;
  /** One line shown in the AdminCP. */
  description?: string;
  /** Local id, unique within the plugin: `excerpt.generate`. */
  id: Id;
  inputSchema: InputSchema;
  /** Characters counted against `maxInputCharacters`. Defaults to every string in the input. */
  measureInput?(input: z.output<InputSchema>): number;
  outputSchema: OutputSchema;
  permission: AiPermissionDescriptor | string;
  /** Bump whenever the prompt changes meaningfully; it is stored with every run. */
  promptVersion: number;
  requiredCapabilities: readonly AiModelCapability[];
}

export interface AiTextActionDefinition<
  Id extends string,
  InputSchema extends z.ZodType,
  OutputSchema extends z.ZodType,
> extends AiActionDefinitionBase<Id, InputSchema, OutputSchema> {
  output: "text";
  /** Turns the model's text into the output, before the output schema checks it. */
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

/** A definition after `defineAiAction` filled in its defaults. */
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

/** Checks a limit an admin or a definition chose. Exported for the settings routes. */
export const isValidAiLimit = (
  field: keyof AiActionDefaults,
  value: number,
): boolean => {
  const { max, min } = AI_ACTION_LIMITS[field];

  return Number.isInteger(value) && value >= min && value <= max;
};

/**
 * Declares one AI action a plugin offers. The plugin hands the result to
 * `buildApiPlugin({ aiActions })`; Core owns the model, the limits and the
 * accounting of every run.
 */
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

/** Characters in every string of a value - the default input measure. */
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
