import type { EmbeddingModel, ImageModel, LanguageModel } from "ai";
import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";

import type { AiModelCapability } from "../lib/ai/capabilities";
import type { AiLedger } from "../lib/ai/ledger";
import type { AiPricing } from "../lib/ai/pricing";
import type { TypedAiActionKey } from "../lib/ai/registry";
import type {
  AiRunRequest,
  AiRunResult,
  AiStreamResult,
} from "../lib/ai/runner";
import type { AiProviderAdapter } from "../lib/ai/usage-cost";

import { DEFAULT_AI_MODEL_CAPABILITIES } from "../lib/ai/capabilities";
import { PostgresAiLedger } from "../lib/ai/postgres-ledger";
import { AiActionRegistry } from "../lib/ai/registry";
import { AiRunner, providerIdOf } from "../lib/ai/runner";
import {
  gatewayProviderAdapter,
  openRouterProviderAdapter,
} from "../lib/ai/usage-cost";

/** A run request whose `action` key carries its input and output types. */
export type TypedAiRunRequest<Input, Output> = Omit<
  AiRunRequest,
  "action" | "input"
> & {
  action: TypedAiActionKey<Input, Output>;
  input: Input;
};

/** A language model the installation offers, in the API config's `ai.models`. */
export interface AIModelDefinition {
  /** What the model can do; AI actions needing a capability skip models without it. Defaults to `["text"]`. */
  capabilities?: AiModelCapability[];
  /** Stable id actions and settings refer to. The first model is the default. */
  id: string;
  /** Tokens one input image is estimated at when reserving budget. Defaults to `2000`. */
  imageInputTokens?: number;
  /** A Vercel AI SDK language model, e.g. `openai("gpt-5-mini")`. */
  model: LanguageModel;
  /** Display name in the AdminCP. */
  name: string;
  /** Per-token prices: used to reserve budget before a run, and to cost it when the provider reports no cost. */
  pricing?: AiPricing;
}

/** A text embedding model registered for the `embed`/`embedMany` SDK helpers. */
export interface AIEmbeddingModelDefinition {
  id: string;
  model: EmbeddingModel;
  name: string;
}

/** An image model registered for the `generateImage` SDK helper. */
export interface AIImageModelDefinition {
  id: string;
  model: ImageModel;
  name: string;
}

/** The API config's `ai` option: the models AI features may use. */
export interface AIConfig {
  /** Text embedding models, resolved with `c.get("ai").embeddingModel(id?)`. */
  embeddingModels?: AIEmbeddingModelDefinition[];
  /** Image models, resolved with `c.get("ai").imageModel(id?)`. */
  imageModels?: AIImageModelDefinition[];

  /** Language models; the first is the default. */
  models: AIModelDefinition[];
  /** Read provider-reported costs for providers beyond the built-in AI Gateway and OpenRouter ones. */
  providerAdapters?: AiProviderAdapter[];
}

/** Serializable model info exposed to the client (e.g. via the session API). */
export interface AIPublicModel {
  capabilities: AiModelCapability[];
  id: string;
  model: string;
  name: string;
  provider: string;
}

/** The model's provider id string - the string itself, or a model's `modelId`. */
const toModelId = (model: string | { modelId: string }): string =>
  typeof model === "string" ? model : model.modelId;

/**
 * The installation's AI registry, read in a route as `c.get("ai")`.
 *
 * Two ways to use it: resolve a model with {@link model} and call the Vercel
 * AI SDK yourself, or run a registered AI action with {@link run} or
 * {@link stream}, which also checks the action's permissions, enforces budgets
 * and records usage.
 *
 * Model lookups throw `HTTPException(500)` when no model (or no model with
 * that id) is configured. Action runs throw `AiError`, an `HTTPException`
 * whose JSON body carries a `code` such as `AI_UNAUTHORIZED`, `AI_DISABLED` or
 * `AI_NOT_CONFIGURED`.
 *
 * @example
 * ```ts
 * import { generateText } from "ai";
 *
 * const { text } = await generateText({ model: c.get("ai").model(), prompt });
 * ```
 */
export class AIModel {
  constructor(c: Context, { ledger }: { ledger?: AiLedger } = {}) {
    this.c = c;
    this.ledgerOverride = ledger;
  }

  protected readonly c: Context;
  private readonly ledgerOverride: AiLedger | undefined;
  private runnerInstance: AiRunner | undefined;

  private config(): AIConfig {
    const ai = this.c.get("core").ai;
    if (!ai || ai.models.length === 0) {
      throw new HTTPException(500, {
        message:
          "No AI models configured. Add an `ai.models` entry to buildApiConfig().",
      });
    }

    return ai;
  }

  private runner(): AiRunner {
    this.runnerInstance ??= new AiRunner({
      adapters: [
        ...(this.c.get("core")?.ai?.providerAdapters ?? []),
        gatewayProviderAdapter(),
        openRouterProviderAdapter,
      ],
      c: this.c,
      ledger: this.ledger(),
      models: this.c.get("core")?.ai?.models ?? [],
      registry: this.actions(),
    });

    return this.runnerInstance;
  }

  /** Every registered AI action. */
  actions(): AiActionRegistry {
    return this.c.get("core")?.aiActions ?? new AiActionRegistry([]);
  }

  /** A model's capabilities; omit `id` for the default model. */
  capabilities(id?: string): AiModelCapability[] {
    const entry = this.definition(id);

    return [...(entry.capabilities ?? DEFAULT_AI_MODEL_CAPABILITIES)];
  }

  /** A model's configured definition; omit `id` for the default (first) model. */
  definition(id?: string): AIModelDefinition {
    const { models } = this.config();
    const found = id ? models.find(entry => entry.id === id) : models[0];
    if (!found) {
      throw new HTTPException(500, {
        message: `AI model "${id}" is not configured.`,
      });
    }

    return found;
  }

  /**
   * Resolve an embedding model to pass into `embed`/`embedMany`. Omit `id` for
   * the first configured embedding model.
   */
  embeddingModel(id?: string): EmbeddingModel {
    const models = this.config().embeddingModels ?? [];
    if (models.length === 0) {
      throw new HTTPException(500, {
        message:
          "No AI embedding models configured. Add an `ai.embeddingModels` entry to buildApiConfig().",
      });
    }
    const found = id ? models.find(entry => entry.id === id) : models[0];
    if (!found) {
      throw new HTTPException(500, {
        message: `AI embedding model "${id}" is not configured.`,
      });
    }

    return found.model;
  }

  /** The most a run could cost, in points and USD; `null` when the price is unknown. */
  async estimate(
    request: AiRunRequest,
  ): Promise<{ maxPoints: null | string; maxUsd: null | string }> {
    return await this.runner().estimate(request);
  }

  /**
   * Resolve an image model to pass into `generateImage`. Omit `id` for the
   * first configured image model.
   */
  imageModel(id?: string): ImageModel {
    const models = this.config().imageModels ?? [];
    if (models.length === 0) {
      throw new HTTPException(500, {
        message:
          "No AI image models configured. Add an `ai.imageModels` entry to buildApiConfig().",
      });
    }
    const found = id ? models.find(entry => entry.id === id) : models[0];
    if (!found) {
      throw new HTTPException(500, {
        message: `AI image model "${id}" is not configured.`,
      });
    }

    return found.model;
  }

  /** Where runs and usage are recorded: Postgres unless the model was built with another ledger. */
  ledger(): AiLedger {
    return this.ledgerOverride ?? new PostgresAiLedger(this.c.get("db"));
  }

  /**
   * Resolve a language model to pass into `generateText`, `streamText`,
   * `generateObject`, etc. Omit `id` for the default (first) model.
   */
  model(id?: string): LanguageModel {
    return this.definition(id).model;
  }

  /** The configured models as serializable info, safe to send to the browser. Empty when AI is off. */
  models(): AIPublicModel[] {
    const ai = this.c.get("core").ai;

    return (ai?.models ?? []).map(entry => ({
      capabilities: [...(entry.capabilities ?? DEFAULT_AI_MODEL_CAPABILITIES)],
      id: entry.id,
      model: toModelId(entry.model),
      name: entry.name,
      provider: providerIdOf(entry.model),
    }));
  }
  /**
   * Runs a registered AI action for the signed-in user (the admin on admin
   * paths), validating its input and output, checking its permissions and
   * budgets, and recording usage.
   *
   * @throws `AiError` with `AI_UNAUTHORIZED` for a guest or a user the action
   * does not allow, or another code when the action is unknown, disabled,
   * unconfigured, over budget or fails.
   */
  async run<Input, Output>(
    request: TypedAiRunRequest<Input, Output>,
  ): Promise<AiRunResult<Output>>;
  async run(request: AiRunRequest): Promise<AiRunResult<unknown>>;
  async run(request: AiRunRequest): Promise<AiRunResult<unknown>> {
    return await this.runner().run(request);
  }
  /**
   * {@link run} without a user, for jobs and other background work. Only for
   * actions whose `actors` include `system`; usage is recorded against no user.
   */
  async runAsSystem<Input, Output>(
    request: TypedAiRunRequest<Input, Output>,
  ): Promise<AiRunResult<Output>>;
  async runAsSystem(request: AiRunRequest): Promise<AiRunResult<unknown>>;
  async runAsSystem(request: AiRunRequest): Promise<AiRunResult<unknown>> {
    return await this.runner().runAsSystem(request);
  }

  /**
   * {@link run}, streaming the text as it arrives. Only for actions with text
   * output; `result` settles once the stream ends.
   */
  async stream<Input, Output>(
    request: TypedAiRunRequest<Input, Output>,
  ): Promise<AiStreamResult<Output>>;
  async stream(request: AiRunRequest): Promise<AiStreamResult<unknown>>;
  async stream(request: AiRunRequest): Promise<AiStreamResult<unknown>> {
    return await this.runner().stream(request);
  }
}
