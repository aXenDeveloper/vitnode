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
  /** Extra guidance an admin set for this action in the AdminCP, or `null`. Append it to the system prompt. */
  instructions: null | string;
}

export interface AiAuthorizeContext<Input> {
  c: Context<EnvVitNode>;
  input: Input;
  resource: AiResourceRef | undefined;
  userId: number;
}

/** The AI permission admins grant per role. Actions sharing a key share one switch and one daily counter. */
export interface AiPermissionDescriptor {
  /** Whether roles hold it until an admin changes it. */
  defaultGranted: boolean;
  key: string;
}

/** Per-action limits; admins can change them in the AdminCP. Ranges are in {@link AI_ACTION_LIMITS}. */
export interface AiActionDefaults {
  /** Runs per user per day for the action's permission; `null` (default) for no limit. */
  dailyLimit: null | number;
  /** Images per run. Defaults to 1 with the `image-input` capability, else 0. */
  maxImages: number;
  /** Input size, counted by `measureInput` or every string in the input. */
  maxInputCharacters: number;
  maxOutputTokens: number;
  /** Provider retries. Defaults to 0. */
  maxRetries: number;
  /** Tool-loop steps. Defaults to 1. */
  maxSteps: number;
  /** Provider timeout in milliseconds. */
  timeoutMs: number;
}

export type AiActionOutputMode = "object" | "text";

/* oxlint-disable typescript/method-signature-style -- method
   signatures are bivariant, which keeps a typed action assignable to the
   registry's `AnyAiActionDefinition`. */
interface AiActionDefinitionBase<
  Id extends string,
  InputSchema extends z.ZodType,
  OutputSchema extends z.ZodType,
> {
  /**
   * Who may run it: `user` through `c.get("ai").run()`, `system` through
   * `runAsSystem()`. Defaults to `["user"]`.
   */
  actors?: readonly AiActorType[];
  /**
   * Checks the caller may read the content the input refers to - the AI
   * permission never replaces that. Required when `actors` includes `user`.
   */
  authorize?(
    context: AiAuthorizeContext<z.output<InputSchema>>,
  ): boolean | Promise<boolean>;
  /** Builds the prompt from the validated input. */
  buildPrompt(input: z.output<InputSchema>, context: AiPromptContext): AiPrompt;
  defaults: Partial<AiActionDefaults> &
    Pick<
      AiActionDefaults,
      "maxInputCharacters" | "maxOutputTokens" | "timeoutMs"
    >;
  /** Message key of one sentence on what the action does. */
  description: string;
  /** Lucide icon name in kebab case, e.g. `"languages"`. */
  icon?: string;
  /**
   * Lowercase, dot-separated id local to the plugin, e.g. `"excerpt.generate"`.
   * Core stores it as `<pluginId>:<id>`.
   */
  id: Id;
  inputSchema: InputSchema;
  /** Characters counted against `maxInputCharacters`; by default every string in the input. */
  measureInput?(input: z.output<InputSchema>): number;
  /** Validates the model's answer. */
  outputSchema: OutputSchema;
  /** A permission key (not granted by default) or a full descriptor. */
  permission: AiPermissionDescriptor | string;
  /** Whole number of 1 or more, stored with every run. Bump it when the prompt changes meaningfully. */
  promptVersion: number;
  /** Model capabilities the action needs; at least `"text"`, plus `"structured-output"` for `output: "object"`. */
  requiredCapabilities: readonly AiModelCapability[];
  /** Message key of a short name for the AdminCP and member settings. */
  title: string;
}

export interface AiTextActionDefinition<
  Id extends string,
  InputSchema extends z.ZodType,
  OutputSchema extends z.ZodType,
> extends AiActionDefinitionBase<Id, InputSchema, OutputSchema> {
  output: "text";
  /** Turns the model's text into the value checked by `outputSchema`. */
  parseText(text: string, input: z.output<InputSchema>): z.input<OutputSchema>;
}

export interface AiObjectActionDefinition<
  Id extends string,
  InputSchema extends z.ZodType,
  OutputSchema extends z.ZodType,
> extends AiActionDefinitionBase<Id, InputSchema, OutputSchema> {
  output: "object";
}

/* oxlint-enable typescript/method-signature-style */

/** What a plugin passes to {@link defineAiAction}: a text action or a structured-object action. */
export type AiActionDefinition<
  Id extends string = string,
  InputSchema extends z.ZodType = z.ZodType,
  OutputSchema extends z.ZodType = z.ZodType,
> =
  | AiObjectActionDefinition<Id, InputSchema, OutputSchema>
  | AiTextActionDefinition<Id, InputSchema, OutputSchema>;

/** An action after {@link defineAiAction} filled in `actors`, `defaults` and `permission`. */
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

/** Thrown by {@link defineAiAction} when the module loads with an invalid definition. */
export class AiActionDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiActionDefinitionError";
  }
}

/** Allowed range of each {@link AiActionDefaults} value. */
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

/**
 * Declares a managed AI feature. Register it in `buildApiPlugin({ aiActions })`
 * and run it with `c.get("ai").run()`; core picks the model and enforces
 * permissions, limits and budgets, and records every run.
 *
 * @throws {AiActionDefinitionError} For an invalid id, icon, permission key or
 * `promptVersion`, an empty title or description, missing or unsupported
 * capabilities, a default outside {@link AI_ACTION_LIMITS}, no actors, or a
 * `user` action without `authorize`.
 *
 * @example
 * ```ts
 * import { defineAiAction } from "@vitnode/core/api/lib/ai/action";
 * import { checkStaffPermission } from "@vitnode/core/api/lib/check-staff-permission";
 * import { z } from "zod";
 *
 * export const summarizeAiAction = defineAiAction({
 *   id: "topic.summarize",
 *   title: "ai_actions.@acme/forum.topic_summarize.title",
 *   description: "ai_actions.@acme/forum.topic_summarize.description",
 *   promptVersion: 1,
 *   permission: "summarize",
 *   requiredCapabilities: ["text"],
 *   defaults: { maxInputCharacters: 50_000, maxOutputTokens: 300, timeoutMs: 30_000 },
 *   inputSchema: z.object({ content: z.string().min(1) }),
 *   output: "text",
 *   outputSchema: z.string().min(1),
 *   parseText: text => text.trim(),
 *   buildPrompt: (input, { instructions }) => ({
 *     system: ["Summarize in two sentences.", instructions].filter(Boolean).join("\n"),
 *     prompt: input.content,
 *   }),
 *   // The AI permission never replaces access to the content itself.
 *   authorize: async ({ c }) =>
 *     await checkStaffPermission(c, {
 *       type: "admin",
 *       plugin: "@acme/forum",
 *       module: "topics",
 *       permission: "can_view",
 *     }),
 * });
 * ```
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
