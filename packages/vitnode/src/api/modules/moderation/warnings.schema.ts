import { z } from "@hono/zod-openapi";

import { WARNING_LIMITS } from "@/lib/moderation/warnings";

import { errorSchema, json } from "./moderation.schema";

export const body = <T extends z.ZodType>(schema: T) => ({
  body: { content: { "application/json": { schema } }, required: true },
});

export const idParams = z.object({
  id: z.coerce.number().int().positive().openapi({ example: 1 }),
});

const expirationSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("default") }),
  z.object({ mode: z.literal("never") }),
  z.object({
    mode: z.literal("hours"),
    hours: z.number().int().min(1).max(WARNING_LIMITS.maxDurationHours),
  }),
  z.object({ mode: z.literal("at"), at: z.iso.datetime() }),
]);

export const draftSchema = z.object({
  userId: z.number().int().positive(),
  reasonId: z.number().int().positive().nullable(),
  points: z.number().int().min(0).max(WARNING_LIMITS.maxPoints).nullish(),
  expiration: expirationSchema.default({ mode: "default" }),
  content: z
    .object({
      pluginId: z.string().min(1).max(100),
      targetType: z.string().min(1).max(100),
      targetId: z.string().min(1).max(64),
    })
    .nullish(),
  reportId: z.number().int().positive().nullish(),
});

export const revokeSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(WARNING_LIMITS.explanationMinLength)
    .max(WARNING_LIMITS.noteMaxLength),
});

export const commonResponses = {
  400: json(errorSchema, "Invalid input"),
  401: { description: "Sign in first" },
  403: json(errorSchema, "Not allowed for this moderator or this member"),
  404: json(errorSchema, "No such member, reason, content or report"),
  409: json(errorSchema, "The state changed, or the reason is disabled"),
};
