import type {
  LanguageModel,
  LanguageModelUsage,
  ModelMessage,
  ProviderMetadata,
} from "ai";
import type { Context } from "hono";

import {
  APICallError,
  generateText,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
  stepCountIs,
  streamText,
} from "ai";

import type { AIModelDefinition } from "../../models/ai";
import type { VitNodeEvents } from "../../models/events";
import type { AiActorType, AiPrompt, AiResourceRef } from "./action";
import type { AiModelCapability } from "./capabilities";
import type { Decimal } from "./decimal";
import type { AiErrorCode } from "./errors";
import type {
  AiActionSettings,
  AiLedger,
  AiSettingsSnapshot,
  AiSettlement,
  AiUserPolicy,
} from "./ledger";
import type { AiActionRegistry, RegisteredAiAction } from "./registry";
import type {
  AiCost,
  AiEffectivePricing,
  AiProviderAdapter,
  AiUsage,
} from "./usage-cost";

import { countInputCharacters } from "./action";
import {
  DEFAULT_AI_MODEL_CAPABILITIES,
  missingCapabilities,
} from "./capabilities";
import { formatDecimal, sumDecimals } from "./decimal";
import { AiError } from "./errors";
import { usdToPoints } from "./ledger";
import { maxCallCost, pricingFingerprint } from "./pricing";
import {
  normalizeUsage,
  resolveCost,
  resolveProviderAdapter,
} from "./usage-cost";

/** Tokens one image may count as, when a model entry does not say. */
export const DEFAULT_IMAGE_INPUT_TOKENS = 2_000;
/** Fixed prompt overhead (roles, separators) added to every bound. */
const PROMPT_OVERHEAD_TOKENS = 64;
/** Slack added to an execution lease beyond the timeouts it covers. */
const LEASE_SLACK_MS = 60_000;

export interface AiRunRequest {
  action: string;
  /** A client-supplied key; the same key never runs - or charges - twice. */
  idempotencyKey?: string;
  input: unknown;
  resource?: AiResourceRef;
  signal?: AbortSignal;
  /** Fingerprint of the content the input came from, to detect stale results. */
  sourceFingerprint?: string;
}

/** Safe usage metadata a route may return to the browser. */
export interface AiRunUsage {
  /** Points charged to the user, full precision; `"0"` for system work. */
  chargedPoints: string;
  costKnown: boolean;
  modelId: string;
}

export interface AiRunResult<Output> {
  output: Output;
  runId: number;
  usage: AiRunUsage;
}

export interface AiStreamResult<Output> {
  /** Resolves when the stream ends, with the validated output. Rejects with an `AiError`. */
  result: Promise<AiRunResult<Output>>;
  runId: number;
  /** Text deltas. Cancelling it cancels the provider call. */
  textStream: ReadableStream<string>;
}

interface Actor {
  type: AiActorType;
  userId: null | number;
}

interface ResolvedModel {
  capabilities: readonly string[];
  definition: AIModelDefinition;
  pricing: AiEffectivePricing | null;
  provider: string;
  providerModelId: string;
}

interface ExecutionPlan {
  action: RegisteredAiAction;
  actionSettings: AiActionSettings | null;
  actor: Actor;
  fallback: null | ResolvedModel;
  input: unknown;
  maxOutputTokens: number;
  maxRetries: number;
  maxSteps: number;
  policy: AiUserPolicy | null;
  primary: ResolvedModel;
  prompt: AiPrompt;
  promptImages: number;
  settings: AiSettingsSnapshot;
  timeoutMs: number;
}

interface CallOutcome {
  cost: AiCost;
  errorCode: AiErrorCode | null;
  images: number;
  providerModelId: null | string;
  providerRequestId: null | string;
  status: "failed" | "succeeded";
  usage: AiUsage;
}

const UNKNOWN_USAGE: AiUsage = {
  cacheReadTokens: null,
  cacheWriteTokens: null,
  inputTokens: null,
  outputTokens: null,
  reasoningTokens: null,
};

export const providerIdOf = (model: LanguageModel): string =>
  typeof model === "string" ? "gateway" : model.provider;

export const providerModelIdOf = (model: LanguageModel): string =>
  typeof model === "string" ? model : model.modelId;

const utf8Length = (text: string) => new TextEncoder().encode(text).length;

/** Text bytes and image parts of a prompt - the input token upper bound. */
export const measurePrompt = (
  prompt: AiPrompt,
): { bytes: number; images: number } => {
  let bytes = utf8Length(prompt.system ?? "");
  let images = 0;
  if ("prompt" in prompt) {
    bytes += utf8Length(prompt.prompt);

    return { bytes, images };
  }

  for (const message of prompt.messages) {
    if (typeof message.content === "string") {
      bytes += utf8Length(message.content);
      continue;
    }
    for (const part of message.content) {
      if (part.type === "text") bytes += utf8Length(part.text);
      else if (part.type === "image") images += 1;
      else if (part.type === "file") {
        if (part.mediaType.startsWith("image/")) images += 1;
        else bytes += typeof part.data === "string" ? utf8Length(part.data) : 0;
      } else bytes += utf8Length(JSON.stringify(part));
    }
  }

  return { bytes, images };
};

/**
 * Runs managed AI actions: authorization, model choice, budgets, provider
 * calls, accounting, validation and settlement - in that order, every time.
 * Provider calls never run inside a database transaction.
 */
export class AiRunner {
  constructor({
    adapters,
    c,
    ledger,
    models,
    registry,
  }: {
    adapters: AiProviderAdapter[];
    c: Context;
    ledger: AiLedger;
    models: AIModelDefinition[];
    registry: AiActionRegistry;
  }) {
    this.adapters = adapters;
    this.c = c;
    this.ledger = ledger;
    this.models = models;
    this.registry = registry;
  }

  private readonly adapters: AiProviderAdapter[];
  private readonly c: Context;
  private readonly ledger: AiLedger;
  private readonly models: AIModelDefinition[];
  private readonly registry: AiActionRegistry;

  private async callOnce(
    plan: ExecutionPlan,
    model: ResolvedModel,
    runId: number,
    attempt: number,
    signal: AbortSignal | undefined,
  ): Promise<{ outcome: CallOutcome; output?: unknown; text?: string }> {
    const { definition } = plan.action;
    const startedAt = new Date();
    const callId = await this.ledger.beginCall({
      attempt,
      modelId: model.definition.id,
      provider: model.provider,
      providerModelId: model.providerModelId,
      runId,
      startedAt,
    });
    const abortSignal = combineSignals(signal, plan.timeoutMs);

    try {
      const result = await generateText({
        ...promptArgs(plan.prompt),
        abortSignal,
        maxOutputTokens: plan.maxOutputTokens,
        maxRetries: 0,
        model: model.definition.model,
        stopWhen: stepCountIs(plan.maxSteps),
        telemetry: {
          isEnabled: false,
          recordInputs: false,
          recordOutputs: false,
        },
        ...(definition.output === "object"
          ? { output: Output.object({ schema: definition.outputSchema }) }
          : {}),
      });

      // Every step is one billable provider call: the first fills the row
      // opened above, later ones get their own. The run sums them once.
      const outcomes = result.steps.map(step =>
        this.describeCall(model, {
          images: plan.promptImages,
          metadata: step.providerMetadata,
          responseId: step.response.id,
          responseModelId: step.response.modelId,
          usage: step.usage,
        }),
      );
      const [first, ...rest] =
        outcomes.length > 0
          ? outcomes
          : [
              this.describeCall(model, {
                images: plan.promptImages,
                metadata: result.finalStep.providerMetadata,
                responseId: result.finalStep.response.id,
                responseModelId: result.finalStep.response.modelId,
                usage: result.usage,
              }),
            ];
      await this.ledger.finishCall(callId, {
        ...first,
        finishedAt: new Date(),
        pricingSnapshot: model.pricing?.pricing ?? null,
      });
      for (const extra of rest) {
        const extraId = await this.ledger.beginCall({
          attempt,
          modelId: model.definition.id,
          provider: model.provider,
          providerModelId: model.providerModelId,
          runId,
          startedAt,
        });
        await this.ledger.finishCall(extraId, {
          ...extra,
          finishedAt: new Date(),
          pricingSnapshot: model.pricing?.pricing ?? null,
        });
      }

      return {
        outcome: first,
        output: definition.output === "object" ? result.output : undefined,
        text: result.text,
      };
    } catch (error) {
      const outcome = this.describeFailure(model, plan, error, signal);
      await this.ledger.finishCall(callId, {
        ...outcome,
        finishedAt: new Date(),
        pricingSnapshot: model.pricing?.pricing ?? null,
      });

      return { outcome };
    }
  }

  private currentUser(): Actor {
    const userId =
      this.c.get("admin")?.user.id ?? this.c.get("user")?.id ?? null;
    if (userId === null) {
      throw new AiError("AI_UNAUTHORIZED", "Sign in to use AI features.");
    }

    return { type: "user", userId };
  }

  private describeCall(
    model: ResolvedModel,
    {
      images,
      metadata,
      responseId,
      responseModelId,
      usage,
    }: {
      images: number;
      metadata: ProviderMetadata | undefined;
      responseId: string | undefined;
      responseModelId: string | undefined;
      usage: LanguageModelUsage | undefined;
    },
  ): CallOutcome {
    const adapter = resolveProviderAdapter(this.adapters, model.provider);
    const normalized = normalizeUsage(usage);

    return {
      cost: resolveCost({
        images,
        pricing: model.pricing,
        reportedCost: adapter.reportedCost(metadata),
        usage: normalized,
      }),
      errorCode: null,
      images,
      providerModelId: responseModelId ?? model.providerModelId,
      providerRequestId: adapter.requestId({ metadata, responseId }),
      status: "succeeded",
      usage: normalized,
    };
  }

  private describeFailure(
    model: ResolvedModel,
    plan: ExecutionPlan,
    error: unknown,
    signal: AbortSignal | undefined,
  ): CallOutcome {
    // The model answered, but not with a valid object: billed like a success.
    if (NoObjectGeneratedError.isInstance(error) && error.usage) {
      return {
        ...this.describeCall(model, {
          images: plan.promptImages,
          metadata: undefined,
          responseId: error.response?.id,
          responseModelId: error.response?.modelId,
          usage: error.usage,
        }),
        errorCode: "AI_INVALID_OUTPUT",
      };
    }

    // A definitive error response: the provider generated nothing to bill.
    if (APICallError.isInstance(error) && error.statusCode !== undefined) {
      return {
        cost: { amountUsd: "0", source: "provider" },
        errorCode: "AI_PROVIDER_FAILED",
        images: plan.promptImages,
        providerModelId: model.providerModelId,
        providerRequestId: null,
        status: "failed",
        usage: { ...UNKNOWN_USAGE, inputTokens: 0, outputTokens: 0 },
      };
    }

    // Aborted, timed out or cut off: the provider may have billed work we
    // never saw. Unknown - and so charged in full - never free.
    let errorCode: AiErrorCode = "AI_PROVIDER_FAILED";
    if (signal?.aborted) errorCode = "AI_CANCELED";
    else if (isTimeout(error)) errorCode = "AI_TIMEOUT";
    else if (NoOutputGeneratedError.isInstance(error))
      errorCode = "AI_INVALID_OUTPUT";

    return {
      cost: {
        amountUsd: null,
        reason: "call did not complete",
        source: "unknown",
      },
      errorCode,
      images: plan.promptImages,
      providerModelId: model.providerModelId,
      providerRequestId: null,
      status: "failed",
      usage: UNKNOWN_USAGE,
    };
  }

  private async emit<K extends "ai.run.completed" | "ai.run.failed">(
    name: K,
    payload: VitNodeEvents[K],
  ): Promise<void> {
    try {
      const events = this.c.get("events");
      if (!events) return;
      await events.emit(name, payload);
    } catch {
      /* events never break a run */
    }
  }

  private async execute(
    request: AiRunRequest,
    actor: Actor,
  ): Promise<AiRunResult<unknown>> {
    const plan = await this.prepare(request, actor);
    const runId = await this.reserve(plan, request);
    await this.ledger.markRunning(
      runId,
      new Date(Date.now() + this.leaseMs(plan)),
    );

    let lastError: AiErrorCode = "AI_PROVIDER_FAILED";
    const candidates: { attempts: number; model: ResolvedModel }[] = [
      { attempts: 1 + plan.maxRetries, model: plan.primary },
      ...(plan.fallback ? [{ attempts: 1, model: plan.fallback }] : []),
    ];
    let attempt = 0;

    for (const candidate of candidates) {
      for (let index = 0; index < candidate.attempts; index++) {
        attempt += 1;
        const call = await this.callOnce(
          plan,
          candidate.model,
          runId,
          attempt,
          request.signal,
        );

        if (call.outcome.status === "succeeded") {
          const parsed = this.validateOutput(
            plan,
            call.text ?? "",
            call.output,
          );
          if (parsed.ok) {
            const settled = await this.settle(runId, {
              delivered: true,
              errorCode: null,
              status: "succeeded",
            });
            await this.emit("ai.run.completed", {
              actionKey: plan.action.key,
              actorType: actor.type,
              runId,
              userId: actor.userId,
            });

            return {
              output: parsed.output,
              runId,
              usage: {
                chargedPoints: formatDecimal(settled.chargedPoints),
                costKnown: settled.costKnown,
                modelId: candidate.model.definition.id,
              },
            };
          }
          lastError = "AI_INVALID_OUTPUT";
          break;
        }

        lastError = call.outcome.errorCode ?? "AI_PROVIDER_FAILED";
        if (lastError === "AI_CANCELED") break;
        if (lastError === "AI_INVALID_OUTPUT") break;
      }
      if (lastError === "AI_CANCELED") break;
    }

    await this.settle(runId, {
      delivered: false,
      errorCode: lastError,
      status: lastError === "AI_CANCELED" ? "canceled" : "failed",
    });
    await this.emit("ai.run.failed", {
      actionKey: plan.action.key,
      actorType: actor.type,
      errorCode: lastError,
      runId,
      userId: actor.userId,
    });

    throw new AiError(lastError, failureMessage(lastError), { runId });
  }

  private leaseMs(plan: ExecutionPlan): number {
    const attempts = 1 + plan.maxRetries + (plan.fallback ? 1 : 0);

    return plan.timeoutMs * attempts + LEASE_SLACK_MS;
  }

  /** Everything up to - not including - the reservation. No money moves here. */
  private async prepare(
    request: AiRunRequest,
    actor: Actor,
    { streaming = false }: { streaming?: boolean } = {},
  ): Promise<ExecutionPlan> {
    const action = this.registry.find(request.action);
    if (!action) {
      throw new AiError(
        "AI_ACTION_UNKNOWN",
        `AI action "${request.action}" is not registered.`,
      );
    }
    const { definition } = action;
    if (!definition.actors.includes(actor.type)) {
      throw new AiError(
        "AI_UNAUTHORIZED",
        `AI action "${action.key}" cannot run for this actor.`,
      );
    }

    const parsedInput = definition.inputSchema.safeParse(request.input);
    if (!parsedInput.success) {
      throw new AiError("AI_INVALID_INPUT", "The AI input is not valid.");
    }
    const input: unknown = parsedInput.data;

    if (this.models.length === 0) {
      throw new AiError("AI_NOT_CONFIGURED", "No AI models configured");
    }

    const [settings, actionSettings] = await Promise.all([
      this.ledger.loadSettings(),
      this.ledger.loadActionSettings(action.key),
    ]);
    if (!settings.enabled) {
      throw new AiError("AI_DISABLED", "AI features are switched off.");
    }
    if (actionSettings?.enabled === false) {
      throw new AiError(
        "AI_ACTION_DISABLED",
        `AI action "${action.key}" is disabled.`,
      );
    }

    let policy: AiUserPolicy | null = null;
    if (actor.type === "user" && actor.userId !== null) {
      policy = await this.ledger.resolveUserPolicy({
        defaultGranted: definition.permission.defaultGranted,
        permissionKey: action.permissionKey,
        userId: actor.userId,
      });
      if (!policy.granted) {
        throw new AiError(
          "AI_UNAUTHORIZED",
          "You do not have access to this AI feature.",
        );
      }
      // An AI permission never replaces access to the content itself.
      const allowed = definition.authorize
        ? await definition.authorize({
            c: this.c,
            input: input,
            resource: request.resource,
            userId: actor.userId,
          })
        : false;
      if (!allowed) {
        throw new AiError(
          "AI_UNAUTHORIZED",
          "You do not have access to this content.",
        );
      }
    }

    const defaults = definition.defaults;
    const maxInputCharacters =
      actionSettings?.maxInputCharacters ?? defaults.maxInputCharacters;
    const measured = definition.measureInput
      ? definition.measureInput(input)
      : countInputCharacters(input);
    if (measured > maxInputCharacters) {
      throw new AiError(
        "AI_INPUT_TOO_LARGE",
        `The input is ${measured} characters; the limit is ${maxInputCharacters}.`,
      );
    }

    // Streaming is a declared capability like any other: a model whose entry
    // does not say it streams is never asked to.
    const required: readonly AiModelCapability[] = streaming
      ? [...definition.requiredCapabilities, "streaming"]
      : definition.requiredCapabilities;
    const primary = this.resolveModel(
      required,
      actionSettings?.modelId ?? null,
    );
    // An incompatible or removed fallback is skipped, never used blindly.
    const fallback = actionSettings?.fallbackModelId
      ? this.tryResolveModel(required, actionSettings.fallbackModelId)
      : null;

    const prompt = definition.buildPrompt(input, {
      instructions: actionSettings?.instructions ?? null,
    });
    const promptImages = measurePrompt(prompt).images;
    if (promptImages > defaults.maxImages) {
      throw new AiError(
        "AI_INPUT_TOO_LARGE",
        `The input has ${promptImages} images; the limit is ${defaults.maxImages}.`,
      );
    }

    return {
      action,
      actionSettings,
      actor,
      fallback:
        fallback && fallback.definition.id !== primary.definition.id
          ? fallback
          : null,
      input,
      maxOutputTokens:
        actionSettings?.maxOutputTokens ?? defaults.maxOutputTokens,
      maxRetries: actionSettings?.maxRetries ?? defaults.maxRetries,
      maxSteps: actionSettings?.maxSteps ?? defaults.maxSteps,
      policy,
      primary,
      prompt,
      promptImages,
      settings,
      timeoutMs: actionSettings?.timeoutMs ?? defaults.timeoutMs,
    };
  }

  /**
   * The most the whole run can cost: every attempt, every step, and the
   * fallback - each at its model's dearest rates with the full output budget.
   * `null` when a model has no pricing and so nothing can bound it.
   */
  private reservationUsd(plan: ExecutionPlan): Decimal | null {
    const { bytes, images } = measurePrompt(plan.prompt);
    const runs: { attempts: number; model: ResolvedModel }[] = [
      { attempts: 1 + plan.maxRetries, model: plan.primary },
      ...(plan.fallback ? [{ attempts: 1, model: plan.fallback }] : []),
    ];
    const parts: Decimal[] = [];
    for (const { attempts, model } of runs) {
      if (!model.pricing) return null;
      const imageTokens =
        images *
        (model.definition.imageInputTokens ?? DEFAULT_IMAGE_INPUT_TOKENS);
      for (let step = 0; step < plan.maxSteps; step++) {
        const perCall = maxCallCost(model.pricing.pricing, {
          images,
          inputTokens:
            bytes +
            imageTokens +
            PROMPT_OVERHEAD_TOKENS +
            step * plan.maxOutputTokens,
          outputTokens: plan.maxOutputTokens,
        });
        for (let attempt = 0; attempt < attempts; attempt++)
          parts.push(perCall);
      }
    }

    return sumDecimals(parts);
  }

  private async reserve(
    plan: ExecutionPlan,
    request: AiRunRequest,
  ): Promise<number> {
    const usd = this.reservationUsd(plan);
    const userPolicy = plan.policy;
    const dailyLimit =
      userPolicy?.dailyLimit ??
      plan.actionSettings?.dailyLimit ??
      plan.action.definition.defaults.dailyLimit;

    const result = await this.ledger.reserve({
      actionKey: plan.action.key,
      actorType: plan.actor.type,
      daily:
        plan.actor.type === "user"
          ? { limit: dailyLimit, permissionKey: plan.action.permissionKey }
          : null,
      globalMonthlyUsd: plan.settings.monthlyBudgetUsd,
      idempotencyKey: request.idempotencyKey ?? null,
      leaseMs: this.leaseMs(plan),
      model: {
        modelId: plan.primary.definition.id,
        provider: plan.primary.provider,
        providerModelId: plan.primary.providerModelId,
      },
      now: new Date(),
      pluginId: plan.action.pluginId,
      promptVersion: plan.action.definition.promptVersion,
      resource: request.resource,
      sourceFingerprint: request.sourceFingerprint ?? null,
      systemConcurrency: plan.settings.systemConcurrency,
      systemMonthlyUsd: plan.settings.systemMonthlyBudgetUsd,
      timeZone: plan.settings.timeZone,
      usd,
      userConcurrency: plan.settings.userConcurrency,
      userId: plan.actor.userId,
      userMonthlyPoints: userPolicy?.monthlyPoints ?? null,
      userRequestsPerMinute: plan.settings.userRequestsPerMinute,
    });

    if (!result.ok) {
      throw new AiError(result.code, failureMessage(result.code), {
        resetsAt: result.resetsAt?.toISOString(),
        runId: result.runId,
      });
    }

    return result.runId;
  }

  private resolveModel(
    requiredCapabilities: readonly AiModelCapability[],
    modelId: null | string,
  ): ResolvedModel {
    const capabilitiesOf = (entry: AIModelDefinition) =>
      entry.capabilities ?? DEFAULT_AI_MODEL_CAPABILITIES;

    const entry = modelId
      ? this.models.find(model => model.id === modelId)
      : this.models.find(
          model =>
            missingCapabilities(requiredCapabilities, capabilitiesOf(model))
              .length === 0,
        );
    if (!entry) {
      throw new AiError(
        "AI_MODEL_INCOMPATIBLE",
        modelId
          ? `AI model "${modelId}" is not configured.`
          : `No configured AI model has the capabilities this action needs: ${requiredCapabilities.join(", ")}.`,
      );
    }
    const missing = missingCapabilities(
      requiredCapabilities,
      capabilitiesOf(entry),
    );
    if (missing.length > 0) {
      throw new AiError(
        "AI_MODEL_INCOMPATIBLE",
        `AI model "${entry.id}" lacks: ${missing.join(", ")}.`,
      );
    }

    return {
      capabilities: capabilitiesOf(entry),
      definition: entry,
      pricing: this.resolvePricing(entry),
      provider: providerIdOf(entry.model),
      providerModelId: providerModelIdOf(entry.model),
    };
  }

  /** The price set on the model in `vitnode.api.config.ts`, if any. */
  private resolvePricing(entry: AIModelDefinition): AiEffectivePricing | null {
    if (!entry.pricing) return null;

    return {
      pricing: entry.pricing,
      source: "pricing",
      version: `config:${pricingFingerprint(entry.pricing)}`,
    };
  }

  private async settle(
    runId: number,
    settlement: Omit<AiSettlement, "finishedAt">,
  ) {
    return await this.ledger.settle(runId, {
      ...settlement,
      finishedAt: new Date(),
    });
  }

  private startStream(
    plan: ExecutionPlan,
    runId: number,
    signal: AbortSignal | undefined,
  ): AiStreamResult<unknown> {
    const controller = new AbortController();
    const forward = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", forward, { once: true });
    const model = plan.primary;
    let resolveResult!: (value: AiRunResult<unknown>) => void;
    let rejectResult!: (reason: unknown) => void;
    const result = new Promise<AiRunResult<unknown>>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });
    // A caller that only reads the stream must not see an unhandled rejection.
    result.catch(() => undefined);

    let callId: null | number = null;
    let text = "";
    let finished = false;
    let activeStream: null | ReturnType<typeof streamText> = null;
    let activeReader: null | ReadableStreamDefaultReader<string> = null;

    const finish = async (
      outcome: CallOutcome,
      delivered: boolean,
      errorCode: AiErrorCode | null,
    ) => {
      if (finished) return;
      finished = true;
      signal?.removeEventListener("abort", forward);
      if (callId !== null) {
        await this.ledger.finishCall(callId, {
          ...outcome,
          finishedAt: new Date(),
          pricingSnapshot: model.pricing?.pricing ?? null,
        });
      }
      const settled = await this.settle(runId, {
        delivered,
        errorCode,
        status: delivered
          ? "succeeded"
          : errorCode === "AI_CANCELED"
            ? "canceled"
            : "failed",
      });
      await this.emit(delivered ? "ai.run.completed" : "ai.run.failed", {
        actionKey: plan.action.key,
        actorType: plan.actor.type,
        errorCode,
        runId,
        userId: plan.actor.userId,
      });

      return settled;
    };

    const textStream = new ReadableStream<string>({
      start: async () => {
        await this.ledger.markRunning(
          runId,
          new Date(Date.now() + this.leaseMs(plan)),
        );
      },
      pull: async streamController => {
        try {
          if (!activeStream) {
            // Recorded on the first read, right before the provider call: a
            // stream nobody reads costs nothing and records no call.
            callId = await this.ledger.beginCall({
              attempt: 1,
              modelId: model.definition.id,
              provider: model.provider,
              providerModelId: model.providerModelId,
              runId,
              startedAt: new Date(),
            });
            activeStream = streamText({
              ...promptArgs(plan.prompt),
              abortSignal: combineSignals(controller.signal, plan.timeoutMs),
              maxOutputTokens: plan.maxOutputTokens,
              maxRetries: 0,
              model: model.definition.model,
              telemetry: {
                isEnabled: false,
                recordInputs: false,
                recordOutputs: false,
              },
            });
            activeReader = activeStream.textStream.getReader();
          }
          const reader = activeReader;
          if (!reader) return;
          const { done, value } = await reader.read();
          if (!done) {
            text += value;
            streamController.enqueue(value);

            return;
          }

          const stream = activeStream;
          const [usage, finalStep] = await Promise.all([
            stream.usage,
            stream.finalStep,
          ]);
          const metadata = finalStep.providerMetadata;
          const response = finalStep.response;
          const outcome = this.describeCall(model, {
            images: plan.promptImages,
            metadata,
            responseId: response.id,
            responseModelId: response.modelId,
            usage,
          });
          const parsed = this.validateOutput(plan, text, undefined);
          if (!parsed.ok) {
            await finish(outcome, false, "AI_INVALID_OUTPUT");
            const error = new AiError(
              "AI_INVALID_OUTPUT",
              failureMessage("AI_INVALID_OUTPUT"),
              { runId },
            );
            rejectResult(error);
            streamController.error(error);

            return;
          }
          const settled = await finish(outcome, true, null);
          resolveResult({
            output: parsed.output,
            runId,
            usage: {
              chargedPoints: formatDecimal(settled?.chargedPoints ?? 0n),
              costKnown: settled?.costKnown ?? false,
              modelId: model.definition.id,
            },
          });
          streamController.close();
        } catch (error) {
          const outcome = this.describeFailure(
            model,
            plan,
            error,
            controller.signal,
          );
          await finish(outcome, false, outcome.errorCode);
          const aiError = new AiError(
            outcome.errorCode ?? "AI_PROVIDER_FAILED",
            failureMessage(outcome.errorCode ?? "AI_PROVIDER_FAILED"),
            { runId },
          );
          rejectResult(aiError);
          streamController.error(aiError);
        }
      },
      cancel: async reason => {
        controller.abort(reason);
        await finish(
          {
            cost: {
              amountUsd: null,
              reason: "canceled mid-stream",
              source: "unknown",
            },
            errorCode: "AI_CANCELED",
            images: plan.promptImages,
            providerModelId: model.providerModelId,
            providerRequestId: null,
            status: "failed",
            usage: UNKNOWN_USAGE,
          },
          false,
          "AI_CANCELED",
        );
        rejectResult(
          new AiError("AI_CANCELED", failureMessage("AI_CANCELED"), { runId }),
        );
      },
    });

    return { result, runId, textStream };
  }

  private tryResolveModel(
    requiredCapabilities: readonly AiModelCapability[],
    modelId: string,
  ): null | ResolvedModel {
    try {
      return this.resolveModel(requiredCapabilities, modelId);
    } catch {
      return null;
    }
  }

  private validateOutput(
    plan: ExecutionPlan,
    text: string,
    output: unknown,
  ): { ok: false } | { ok: true; output: unknown } {
    const { definition } = plan.action;
    let candidate: unknown = output;
    if (definition.output === "text") {
      if (text.trim().length === 0) return { ok: false };
      try {
        candidate = definition.parseText(text, plan.input);
      } catch {
        return { ok: false };
      }
    }
    const parsed = definition.outputSchema.safeParse(candidate);

    return parsed.success ? { ok: true, output: parsed.data } : { ok: false };
  }

  /**
   * The most a run could cost the signed-in user, before running it - the
   * same upper bound the reservation would hold. A bound, never a price:
   * the real charge is usually far lower. `null` when no pricing bounds it.
   */
  async estimate(
    request: AiRunRequest,
  ): Promise<{ maxPoints: null | string; maxUsd: null | string }> {
    const plan = await this.prepare(request, this.currentUser());
    const usd = this.reservationUsd(plan);

    return {
      maxPoints: usd === null ? null : formatDecimal(usdToPoints(usd)),
      maxUsd: usd === null ? null : formatDecimal(usd),
    };
  }

  /** Runs an action for the signed-in user (AdminCP session first). */
  async run(request: AiRunRequest): Promise<AiRunResult<unknown>> {
    return await this.execute(request, this.currentUser());
  }

  /**
   * Runs an action as the trusted system actor - for cron and queue code only.
   * There is no route that reaches this with a client's input.
   */
  async runAsSystem(request: AiRunRequest): Promise<AiRunResult<unknown>> {
    return await this.execute(request, { type: "system", userId: null });
  }

  /** Streams a text action for the signed-in user. */
  async stream(request: AiRunRequest): Promise<AiStreamResult<unknown>> {
    const plan = await this.prepare(request, this.currentUser(), {
      streaming: true,
    });
    if (plan.action.definition.output !== "text") {
      throw new AiError(
        "AI_INVALID_INPUT",
        `AI action "${plan.action.key}" returns an object and cannot be streamed.`,
      );
    }
    const runId = await this.reserve(plan, request);

    return this.startStream(plan, runId, request.signal);
  }
}

const promptArgs = (
  prompt: AiPrompt,
):
  | { messages: ModelMessage[]; system?: string }
  | { prompt: string; system?: string } =>
  "prompt" in prompt
    ? { prompt: prompt.prompt, system: prompt.system }
    : { messages: prompt.messages, system: prompt.system };

const combineSignals = (
  signal: AbortSignal | undefined,
  timeoutMs: number,
): AbortSignal => {
  const timeout = AbortSignal.timeout(timeoutMs);

  return signal ? AbortSignal.any([signal, timeout]) : timeout;
};

const isTimeout = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === "TimeoutError" ||
    (error.name === "AbortError" && /timeout/i.test(error.message)));

const FAILURE_MESSAGES: Partial<Record<AiErrorCode, string>> = {
  AI_BUDGET_EXHAUSTED: "The site's AI budget for this period is used up.",
  AI_CANCELED: "The AI request was canceled.",
  AI_CONCURRENCY_LIMITED:
    "Too many AI requests are running. Try again shortly.",
  AI_DAILY_LIMIT_REACHED: "You reached today's limit for this AI feature.",
  AI_DUPLICATE_REQUEST: "This AI request was already submitted.",
  AI_INVALID_OUTPUT:
    "The AI answer was not usable. Nothing was charged to you.",
  AI_PRICING_MISSING:
    "This AI model has no pricing, so its cost cannot be limited.",
  AI_PROVIDER_FAILED: "The AI provider failed. Nothing was charged to you.",
  AI_RATE_LIMITED: "Too many AI requests. Try again in a minute.",
  AI_TIMEOUT: "The AI provider took too long. Nothing was charged to you.",
  AI_USER_LIMIT_REACHED: "You used all your AI points for this period.",
};

export const failureMessage = (code: AiErrorCode): string =>
  FAILURE_MESSAGES[code] ?? "The AI request failed.";

export const pointsForUsd = (usd: Decimal): string =>
  formatDecimal(usdToPoints(usd));
