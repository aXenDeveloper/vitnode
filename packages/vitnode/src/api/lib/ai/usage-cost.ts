import type { LanguageModelUsage, ProviderMetadata } from "ai";

import type { Decimal } from "./decimal";
import type { AiPriceEstimate, AiPricing } from "./pricing";

import { decimalFromNumber, formatDecimal, parseDecimal } from "./decimal";
import { priceUsage } from "./pricing";

export interface AiUsage {
  cacheReadTokens: null | number;
  cacheWriteTokens: null | number;
  inputTokens: null | number;
  outputTokens: null | number;
  reasoningTokens: null | number;
}

export type AiCostSource = "pricing" | "provider" | "unknown";

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

export interface AiEffectivePricing {
  pricing: AiPricing;
  source: "pricing";
  version: string;
}

export const UNKNOWN_AI_USAGE: AiUsage = {
  cacheReadTokens: null,
  cacheWriteTokens: null,
  inputTokens: null,
  outputTokens: null,
  reasoningTokens: null,
};

const known = (value: number | undefined): null | number =>
  value === undefined || Number.isNaN(value) ? null : value;

export const normalizeUsage = (
  usage: LanguageModelUsage | undefined,
): AiUsage => {
  if (!usage) return { ...UNKNOWN_AI_USAGE };

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

export interface AiProviderAdapter {
  id: string;
  lookupCost?: (requestId: string) => Promise<Decimal | null>;
  matches: (providerId: string) => boolean;
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

export const openRouterProviderAdapter: AiProviderAdapter = {
  id: "openrouter",
  matches: providerId => providerId.startsWith("openrouter"),
  reportedCost: metadata =>
    readNumber(recordOf(recordOf(metadata?.openrouter)?.usage)?.cost),
  requestId: ({ responseId }) => responseId ?? null,
};

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
