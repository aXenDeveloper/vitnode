import type { LanguageModelUsage, ProviderMetadata } from "ai";

import type { Decimal } from "./decimal";
import type { AiPriceEstimate, AiPricing } from "./pricing";

import { decimalFromNumber, formatDecimal, parseDecimal } from "./decimal";
import { priceUsage } from "./pricing";

/** Token counts of one provider call. `null` is unknown; `0` is a known zero. */
export interface AiUsage {
  cacheReadTokens: null | number;
  cacheWriteTokens: null | number;
  inputTokens: null | number;
  outputTokens: null | number;
  /** Already part of `outputTokens` - shown, never billed twice. */
  reasoningTokens: null | number;
}

export type AiCostSource = "pricing" | "provider" | "unknown";

/**
 * What one call cost. Discriminated so an unknown cost can never carry an
 * amount, and an estimate always names the pricing it came from.
 */
export type AiCost =
  | {
      amountUsd: null;
      reason: string;
      source: "unknown";
    }
  | {
      amountUsd: string;
      pricingVersion: string;
      source: "pricing";
    }
  | {
      amountUsd: string;
      source: "provider";
    };

export interface AiUsageCost {
  cost: AiCost;
  usage: AiUsage;
}

/** The pricing that applies to one model on its connection, and where it came from. */
export interface AiEffectivePricing {
  pricing: AiPricing;
  source: "pricing";
  /** Stored with every call so a later price change never rewrites history. */
  version: string;
}

const known = (value: number | undefined): null | number =>
  value === undefined || Number.isNaN(value) ? null : value;

/**
 * The AI SDK's usage, with `undefined` turned into `null`. When a provider
 * reports only the split of output tokens, the total is their sum.
 */
export const normalizeUsage = (
  usage: LanguageModelUsage | undefined,
): AiUsage => {
  if (!usage) {
    return {
      cacheReadTokens: null,
      cacheWriteTokens: null,
      inputTokens: null,
      outputTokens: null,
      reasoningTokens: null,
    };
  }

  const text = known(usage.outputTokenDetails.textTokens);
  const reasoning = known(usage.outputTokenDetails.reasoningTokens);
  const output =
    known(usage.outputTokens) ??
    (text !== null ? text + (reasoning ?? 0) : null);

  return {
    cacheReadTokens: known(usage.inputTokenDetails.cacheReadTokens),
    cacheWriteTokens: known(usage.inputTokenDetails.cacheWriteTokens),
    inputTokens: known(usage.inputTokens),
    outputTokens: output,
    reasoningTokens: reasoning,
  };
};

/**
 * Provider-specific readers. Only the reading of metadata differs between
 * providers; everything after it - pricing, budgets, history - is shared.
 */
export interface AiProviderAdapter {
  id: string;
  /**
   * Looks a request's billed cost up after the fact, for providers that report
   * it out of band. Used by reconciliation, never on the request path.
   */
  lookupCost?: (requestId: string) => Promise<Decimal | null>;
  matches: (providerId: string) => boolean;
  /** The cost the provider itself reported for this call, if any. */
  reportedCost: (metadata: ProviderMetadata | undefined) => Decimal | null;
  requestId: (args: {
    metadata: ProviderMetadata | undefined;
    responseId: string | undefined;
  }) => null | string;
}

const readNumber = (value: unknown): Decimal | null => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return decimalFromNumber(value);
  }
  if (typeof value === "string" && /^\d+(\.\d+)?$/.test(value)) {
    return parseDecimal(value);
  }

  return null;
};

const recordOf = (value: unknown): null | Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/**
 * Vercel AI Gateway (string model ids such as `"anthropic/claude-sonnet-5"`).
 * Its metadata carries a `generationId`; some responses also carry `cost`.
 * When they do not, the generation's billed cost can be looked up later.
 */
export const gatewayProviderAdapter = (
  lookupCost?: AiProviderAdapter["lookupCost"],
): AiProviderAdapter => ({
  id: "gateway",
  lookupCost,
  matches: providerId => providerId === "gateway",
  reportedCost: metadata => readNumber(recordOf(metadata?.gateway)?.cost),
  requestId: ({ metadata, responseId }) => {
    const generationId = recordOf(metadata?.gateway)?.generationId;

    return typeof generationId === "string"
      ? generationId
      : (responseId ?? null);
  },
});

/** OpenRouter-compatible providers report `usage.cost` in their metadata. */
export const openRouterProviderAdapter: AiProviderAdapter = {
  id: "openrouter",
  matches: providerId => providerId.startsWith("openrouter"),
  reportedCost: metadata =>
    readNumber(recordOf(recordOf(metadata?.openrouter)?.usage)?.cost),
  requestId: ({ responseId }) => responseId ?? null,
};

/** Direct providers (Anthropic, Google, OpenAI, …) report no cost - pricing estimates it. */
export const defaultProviderAdapter: AiProviderAdapter = {
  id: "default",
  matches: () => true,
  reportedCost: () => null,
  requestId: ({ responseId }) => responseId ?? null,
};

export const resolveProviderAdapter = (
  adapters: AiProviderAdapter[],
  providerId: string,
): AiProviderAdapter =>
  adapters.find(adapter => adapter.matches(providerId)) ??
  defaultProviderAdapter;

/**
 * Cost resolution, in order:
 * 1. the cost the provider reported for the request;
 * 2. the effective pricing of the model on its connection - an admin's
 *    override replaces the catalog price, it is never ignored;
 * 3. unknown. Never zero by default.
 */
export const resolveCost = ({
  images = 0,
  pricing,
  reportedCost,
  usage,
}: {
  images?: number;
  pricing: AiEffectivePricing | null;
  reportedCost: Decimal | null;
  usage: AiUsage;
}): AiCost => {
  if (reportedCost !== null) {
    return { amountUsd: formatDecimal(reportedCost), source: "provider" };
  }
  if (!pricing) {
    return { amountUsd: null, reason: "no pricing", source: "unknown" };
  }

  const estimate: AiPriceEstimate = priceUsage(pricing.pricing, usage, {
    images,
  });
  if (estimate.status === "incomplete") {
    return { amountUsd: null, reason: estimate.reason, source: "unknown" };
  }

  return {
    amountUsd: formatDecimal(estimate.amount),
    pricingVersion: pricing.version,
    source: pricing.source,
  };
};
