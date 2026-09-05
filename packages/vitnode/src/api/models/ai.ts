import type { EmbeddingModel, ImageModel, LanguageModel } from "ai";
import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";

export interface AIModelDefinition {
  id: string;
  model: LanguageModel;
  name: string;
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
}

/** Serializable model info exposed to the client (e.g. via the session API). */
export interface AIPublicModel {
  id: string;
  model: string;
  name: string;
}

/** The model's provider id string - the string itself, or a model's `modelId`. */
const toModelId = (model: string | { modelId: string }): string =>
  typeof model === "string" ? model : model.modelId;

export class AIModel {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;

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

  /**
   * Resolve a language model to pass into `generateText`, `streamText`,
   * `generateObject`, etc. Omit `id` for the default (first) model.
   */
  model(id?: string): LanguageModel {
    const { models } = this.config();
    const found = id ? models.find(entry => entry.id === id) : models[0];
    if (!found) {
      throw new HTTPException(500, {
        message: `AI model "${id}" is not configured.`,
      });
    }

    return found.model;
  }

  models(): AIPublicModel[] {
    const ai = this.c.get("core").ai;

    return (ai?.models ?? []).map(entry => ({
      id: entry.id,
      model: toModelId(entry.model),
      name: entry.name,
    }));
  }
}
