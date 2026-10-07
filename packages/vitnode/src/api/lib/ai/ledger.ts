import type { AiActorType, AiResourceRef } from "./action";
import type { Decimal } from "./decimal";
import type { AiErrorCode } from "./errors";
import type { AiPricing } from "./pricing";
import type { AiCost, AiUsage } from "./usage-cost";

import { divideDecimal, multiplyDecimal, parseDecimal } from "./decimal";

/**
 * Point conversion, version 1: 1 AI point = 0.001 USD of chargeable API cost.
 * Points are an internal usage unit, not a currency anyone buys. Changing the
 * rate means a new version - stored on every run - never an edit of this one.
 */
export const AI_POINTS_CONVERSION = {
  1: { usdPerPoint: "0.001" },
} as const;
export const AI_POINTS_CONVERSION_VERSION = 1;

export const usdToPoints = (
  usd: Decimal,
  version: keyof typeof AI_POINTS_CONVERSION = AI_POINTS_CONVERSION_VERSION,
): Decimal =>
  divideDecimal(usd, parseDecimal(AI_POINTS_CONVERSION[version].usdPerPoint));

export const pointsToUsd = (
  points: Decimal,
  version: keyof typeof AI_POINTS_CONVERSION = AI_POINTS_CONVERSION_VERSION,
): Decimal =>
  multiplyDecimal(
    points,
    parseDecimal(AI_POINTS_CONVERSION[version].usdPerPoint),
  );

export interface AiSettingsSnapshot {
  altBatchSize: number;
  altEnabled: boolean;
  defaultMonthlyPoints: Decimal;
  enabled: boolean;
  historyRetentionDays: number;
  monthlyBudgetUsd: Decimal | null;
  systemConcurrency: number;
  systemMonthlyBudgetUsd: Decimal | null;
  /** The site's time zone - the default language's - for calendar periods. */
  timeZone: string;
  userConcurrency: number;
  userRequestsPerMinute: number;
}

export interface AiActionSettings {
  dailyLimit: null | number;
  enabled: boolean;
  fallbackModelId: null | string;
  instructions: null | string;
  maxInputCharacters: null | number;
  maxOutputTokens: null | number;
  maxRetries: null | number;
  maxSteps: null | number;
  modelId: null | string;
  timeoutMs: null | number;
}

export interface AiUserPolicy {
  /** Largest daily limit any granting role gives; `null` is no limit. */
  dailyLimit: null | number;
  granted: boolean;
  /** Monthly points; `null` is unlimited. */
  monthlyPoints: Decimal | null;
}

export interface AiBudgetRequest {
  /** USD upper bound of the whole run; `null` when no pricing can bound it. */
  usd: Decimal | null;
}

export interface AiReservationRequest {
  actionKey: string;
  actorType: AiActorType;
  daily: null | { limit: null | number; permissionKey: string };
  globalMonthlyUsd: Decimal | null;
  idempotencyKey: null | string;
  leaseMs: number;
  model: { modelId: string; provider: string; providerModelId: string };
  now: Date;
  pluginId: string;
  promptVersion: number;
  resource: AiResourceRef | undefined;
  sourceFingerprint: null | string;
  systemConcurrency: number;
  systemMonthlyUsd: Decimal | null;
  timeZone: string;
  usd: Decimal | null;
  userConcurrency: number;
  userId: null | number;
  userMonthlyPoints: Decimal | null;
  userRequestsPerMinute: number;
}

export type AiReservationResult =
  | {
      code: AiErrorCode;
      ok: false;
      resetsAt?: Date;
      /** An earlier run with the same idempotency key. */
      runId?: number;
    }
  | { ok: true; runId: number };

export interface AiCallStart {
  attempt: number;
  modelId: string;
  provider: string;
  providerModelId: string;
  runId: number;
  startedAt: Date;
}

export interface AiCallFinish {
  cost: AiCost;
  errorCode: null | string;
  finishedAt: Date;
  images: number;
  pricingSnapshot: AiPricing | null;
  providerModelId: null | string;
  providerRequestId: null | string;
  status: "failed" | "succeeded";
  usage: AiUsage;
}

export interface AiSettlement {
  /** A valid result reached the user. Only then are personal points charged. */
  delivered: boolean;
  errorCode: null | string;
  finishedAt: Date;
  status: "canceled" | "failed" | "succeeded" | "uncertain";
}

export interface AiSettlementResult {
  /** `false` when the run had already been settled - nothing changed. */
  applied: boolean;
  chargedPoints: Decimal;
  chargedUsd: Decimal;
  costKnown: boolean;
}

/**
 * Where AI money and history live. The Postgres ledger is the real one; the
 * memory ledger is a test seam with the same rules (`budget.ts`).
 */
export interface AiLedger {
  /** Records the start of a provider call before it is made - a crash leaves it `uncertain`. */
  beginCall: (call: AiCallStart) => Promise<number>;
  finishCall: (callId: number, call: AiCallFinish) => Promise<void>;
  loadActionSettings: (actionKey: string) => Promise<AiActionSettings | null>;
  loadSettings: () => Promise<AiSettingsSnapshot>;
  markRunning: (runId: number, leaseExpiresAt: Date) => Promise<void>;
  /** Atomically checks and holds every applicable budget and counter. */
  reserve: (request: AiReservationRequest) => Promise<AiReservationResult>;
  resolveUserPolicy: (args: {
    defaultGranted: boolean;
    permissionKey: string;
    userId: number;
  }) => Promise<AiUserPolicy>;
  /** Idempotent: a second settlement of the same run changes nothing. */
  settle: (
    runId: number,
    settlement: AiSettlement,
  ) => Promise<AiSettlementResult>;
}
