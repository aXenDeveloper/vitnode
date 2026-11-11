import { z } from "zod";

import { AI_ACTION_LIMITS } from "@/api/lib/ai/action";
import { AI_MODEL_CAPABILITIES } from "@/api/lib/ai/capabilities";
import { zodAiPricing } from "@/api/lib/ai/pricing";
import { AI_RUN_STATUSES } from "@/database/ai";

export const zodDecimalString = z
  .string()
  .regex(/^\d+(\.\d{1,12})?$/, 'Use a non-negative decimal, e.g. "25.00".');

const limit = (field: keyof typeof AI_ACTION_LIMITS) =>
  z
    .number()
    .int()
    .min(AI_ACTION_LIMITS[field].min)
    .max(AI_ACTION_LIMITS[field].max);

export const zodAiSettings = z.object({
  altBatchSize: z.number().int().min(1).max(100),
  altEnabled: z.boolean(),
  defaultMonthlyPoints: zodDecimalString,
  enabled: z.boolean(),
  historyRetentionDays: z.number().int().min(7).max(3650),
  monthlyBudgetUsd: zodDecimalString.nullable(),
  systemConcurrency: z.number().int().min(1).max(20),
  systemMonthlyBudgetUsd: zodDecimalString.nullable(),
  userConcurrency: z.number().int().min(1).max(20),
  userRequestsPerMinute: z.number().int().min(1).max(600),
});

export const zodAiSettingsResponse = zodAiSettings.extend({
  pointsConversion: z.object({ usdPerPoint: z.string(), version: z.number() }),
  timeZone: z.string(),
});

export const zodAiCapability = z.enum(AI_MODEL_CAPABILITIES);

export const zodAiModel = z.object({
  capabilities: z.array(zodAiCapability),
  id: z.string(),
  model: z.string(),
  name: z.string(),
  pricing: zodAiPricing.nullable(),
  provider: z.string(),
});

export const zodAiActionSettingsInput = z.object({
  dailyLimit: limit("dailyLimit").nullable(),
  enabled: z.boolean(),
  fallbackModelId: z.string().max(100).nullable(),
  instructions: z.string().max(2_000).nullable(),
  key: z.string().min(3).max(255),
  maxInputCharacters: limit("maxInputCharacters").nullable(),
  maxOutputTokens: limit("maxOutputTokens").nullable(),
  maxRetries: limit("maxRetries").nullable(),
  maxSteps: limit("maxSteps").nullable(),
  modelId: z.string().max(100).nullable(),
  timeoutMs: limit("timeoutMs").nullable(),
});

export const zodAiAction = z.object({
  actors: z.array(z.enum(["system", "user"])),
  compatibleModelIds: z.array(z.string()),
  defaults: z.object({
    dailyLimit: z.number().nullable(),
    maxImages: z.number(),
    maxInputCharacters: z.number(),
    maxOutputTokens: z.number(),
    maxRetries: z.number(),
    maxSteps: z.number(),
    timeoutMs: z.number(),
  }),
  description: z.string(),
  icon: z.string().nullable(),
  key: z.string(),
  localId: z.string(),
  output: z.enum(["object", "text"]),
  permission: z.object({ defaultGranted: z.boolean(), key: z.string() }),
  pluginId: z.string(),
  promptVersion: z.number(),
  requiredCapabilities: z.array(zodAiCapability),
  settings: zodAiActionSettingsInput.omit({ key: true }),
  title: z.string(),
});

export const zodAiRunStatus = z.enum(AI_RUN_STATUSES);

export const zodAiRunRow = z.object({
  accepted: z.boolean().nullable(),
  actionKey: z.string(),
  actorType: z.enum(["system", "user"]),
  chargedPoints: z.string().nullable(),
  chargedUsd: z.string().nullable(),
  costSource: z.string().nullable(),
  costUsd: z.string().nullable(),
  createdAt: z.date(),
  errorCode: z.string().nullable(),
  finishedAt: z.date().nullable(),
  id: z.number(),
  inputTokens: z.number().nullable(),
  modelId: z.string().nullable(),
  outputTokens: z.number().nullable(),
  provider: z.string().nullable(),
  resourceId: z.string().nullable(),
  resourceType: z.string().nullable(),
  status: zodAiRunStatus,
  user: z
    .object({ id: z.number(), name: z.string(), nameCode: z.string() })
    .nullable(),
});
