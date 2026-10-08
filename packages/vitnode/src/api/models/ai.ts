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

export type TypedAiRunRequest<Input, Output> = Omit<
  AiRunRequest,
  "action" | "input"
> & {
  action: TypedAiActionKey<Input, Output>;
  input: Input;
};

export interface AIModelDefinition {
  capabilities?: AiModelCapability[];
  id: string;
  imageInputTokens?: number;
  model: LanguageModel;
  name: string;
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

export interface AIConfig {
  /** Text embedding models, resolved with `c.get("ai").embeddingModel(id?)`. */
  embeddingModels?: AIEmbeddingModelDefinition[];
  /** Image models, resolved with `c.get("ai").imageModel(id?)`. */
  imageModels?: AIImageModelDefinition[];

  models: AIModelDefinition[];
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

  actions(): AiActionRegistry {
    return this.c.get("core")?.aiActions ?? new AiActionRegistry([]);
  }

  capabilities(id?: string): AiModelCapability[] {
    const entry = this.definition(id);

    return [...(entry.capabilities ?? DEFAULT_AI_MODEL_CAPABILITIES)];
  }

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
  async run<Input, Output>(
    request: TypedAiRunRequest<Input, Output>,
  ): Promise<AiRunResult<Output>>;
  async run(request: AiRunRequest): Promise<AiRunResult<unknown>>;
  async run(request: AiRunRequest): Promise<AiRunResult<unknown>> {
    return await this.runner().run(request);
  }
  async runAsSystem<Input, Output>(
    request: TypedAiRunRequest<Input, Output>,
  ): Promise<AiRunResult<Output>>;
  async runAsSystem(request: AiRunRequest): Promise<AiRunResult<unknown>>;
  async runAsSystem(request: AiRunRequest): Promise<AiRunResult<unknown>> {
    return await this.runner().runAsSystem(request);
  }

  async stream<Input, Output>(
    request: TypedAiRunRequest<Input, Output>,
  ): Promise<AiStreamResult<Output>>;
  async stream(request: AiRunRequest): Promise<AiStreamResult<unknown>>;
  async stream(request: AiRunRequest): Promise<AiStreamResult<unknown>> {
    return await this.runner().stream(request);
  }
}
