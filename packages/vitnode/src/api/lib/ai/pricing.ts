import { z } from "zod";

import type { Decimal } from "./decimal";
import type { AiUsage } from "./usage-cost";

import {
  decimalFromInteger,
  divideByInteger,
  maxDecimal,
  multiplyByInteger,
  parseDecimal,
  sumDecimals,
} from "./decimal";

const zodPrice = z
  .string()
  .regex(
    /^\d+(\.\d+)?$/,
    'A price is a non-negative decimal string, e.g. "3.00".',
  );

export const zodAiPricingRates = z.object({
  inputPerMillion: zodPrice,
  outputPerMillion: zodPrice,
  cacheReadPerMillion: zodPrice.optional(),
  cacheWritePerMillion: zodPrice.optional(),
  perRequest: zodPrice.optional(),
  perImage: zodPrice.optional(),
});

export type AiPricingRates = z.infer<typeof zodAiPricingRates>;

export const zodAiPricing = z.object({
  rates: zodAiPricingRates,
  tiers: z
    .array(
      z.object({
        aboveInputTokens: z.number().int().positive(),
        rates: zodAiPricingRates,
      }),
    )
    .optional(),
});

export type AiPricing = z.infer<typeof zodAiPricing>;

export const assertAiModelPricing = (
  models: readonly { id: string; pricing?: unknown }[],
): void => {
  for (const model of models) {
    if (model.pricing === undefined) continue;
    const parsed = zodAiPricing.safeParse(model.pricing);
    if (!parsed.success) {
      throw new Error(
        `AI model "${model.id}" has invalid pricing: ${z.prettifyError(parsed.error)}`,
      );
    }
  }
};

export type AiPriceEstimate =
  | { amount: Decimal; status: "complete" }
  | { reason: string; status: "incomplete" };

const PER_MILLION = 1_000_000n;

const priceTokens = (perMillion: string, tokens: number): Decimal =>
  divideByInteger(
    multiplyByInteger(parseDecimal(perMillion), tokens),
    PER_MILLION,
  );

const ratesFor = (pricing: AiPricing, inputTokens: number): AiPricingRates => {
  const tiers = [...(pricing.tiers ?? [])].sort(
    (a, b) => b.aboveInputTokens - a.aboveInputTokens,
  );

  return (
    tiers.find(tier => inputTokens > tier.aboveInputTokens)?.rates ??
    pricing.rates
  );
};

export const priceUsage = (
  pricing: AiPricing,
  usage: AiUsage,
  { images = 0 }: { images?: number } = {},
): AiPriceEstimate => {
  if (usage.inputTokens === null || usage.outputTokens === null) {
    return { status: "incomplete", reason: "token usage was not reported" };
  }

  const cacheRead = usage.cacheReadTokens ?? 0;
  const cacheWrite = usage.cacheWriteTokens ?? 0;
  const uncached = usage.inputTokens - cacheRead - cacheWrite;
  if (uncached < 0) {
    return { status: "incomplete", reason: "cache tokens exceed input tokens" };
  }

  const rates = ratesFor(pricing, usage.inputTokens);
  if (cacheRead > 0 && rates.cacheReadPerMillion === undefined) {
    return { status: "incomplete", reason: "no cache read price" };
  }
  if (cacheWrite > 0 && rates.cacheWritePerMillion === undefined) {
    return { status: "incomplete", reason: "no cache write price" };
  }

  const parts: Decimal[] = [
    priceTokens(rates.inputPerMillion, uncached),
    priceTokens(rates.outputPerMillion, usage.outputTokens),
  ];
  if (cacheRead > 0 && rates.cacheReadPerMillion) {
    parts.push(priceTokens(rates.cacheReadPerMillion, cacheRead));
  }
  if (cacheWrite > 0 && rates.cacheWritePerMillion) {
    parts.push(priceTokens(rates.cacheWritePerMillion, cacheWrite));
  }
  if (rates.perRequest) parts.push(parseDecimal(rates.perRequest));
  if (images > 0 && rates.perImage) {
    parts.push(multiplyByInteger(parseDecimal(rates.perImage), images));
  }

  return { status: "complete", amount: sumDecimals(parts) };
};

export const maxCallCost = (
  pricing: AiPricing,
  {
    images,
    inputTokens,
    outputTokens,
  }: { images: number; inputTokens: number; outputTokens: number },
): Decimal => {
  const candidates = [
    pricing.rates,
    ...(pricing.tiers ?? [])
      .filter(tier => inputTokens > tier.aboveInputTokens)
      .map(tier => tier.rates),
  ];

  return candidates
    .map(rates => {
      const inputRate = [rates.inputPerMillion, rates.cacheWritePerMillion]
        .filter((rate): rate is string => rate !== undefined)
        .map(parseDecimal)
        .reduce(maxDecimal);
      const parts = [
        divideByInteger(multiplyByInteger(inputRate, inputTokens), PER_MILLION),
        priceTokens(rates.outputPerMillion, outputTokens),
        rates.perRequest ? parseDecimal(rates.perRequest) : 0n,
        rates.perImage && images > 0
          ? multiplyByInteger(parseDecimal(rates.perImage), images)
          : 0n,
      ];

      return sumDecimals(parts);
    })
    .reduce(maxDecimal, decimalFromInteger(0));
};

export const pricingFingerprint = (pricing: AiPricing): string => {
  const text = JSON.stringify(pricing);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, "0");
};
