import { z } from "@hono/zod-openapi";

import { createRichTextDocumentSchema } from "@/content/rich-text/document";
import {
  MODERATION_LIMITS,
  MODERATION_REPORT_EVENT_TYPES,
  MODERATION_REPORT_RESOLUTIONS,
  MODERATION_REPORT_STATUSES,
} from "@/lib/moderation/const";

export const reportIdParams = z.object({
  id: z.coerce.number().int().positive().openapi({ example: 1 }),
});

export const expectedVersionBody = z.object({
  expectedVersion: z.number().int().positive(),
});

export const errorSchema = z.object({ error: z.string() });

export const conflictSchema = z.object({
  error: z.string(),
  current: z
    .object({
      assigneeId: z.number().nullable(),
      status: z.enum(MODERATION_REPORT_STATUSES),
      version: z.number(),
    })
    .nullable(),
});

export const reportUserSchema = z.object({
  id: z.number(),
  name: z.string(),
  nameCode: z.string(),
});

export const reportPersonSchema = reportUserSchema.extend({
  avatarColor: z.string(),
  avatarUrl: z.string().nullable(),
  role: z.object({
    color: z.string().nullable(),
    prefix: z.string().nullable(),
  }),
});

export const reportStateSchema = z.object({
  assigneeId: z.number().nullable(),
  status: z.enum(MODERATION_REPORT_STATUSES),
  version: z.number(),
});

export const reasonSchema = z.string().min(1).max(32);
export const resolutionSchema = z.enum(MODERATION_REPORT_RESOLUTIONS);
export const eventTypeSchema = z.enum(MODERATION_REPORT_EVENT_TYPES);

export const noteSchema = z
  .string()
  .trim()
  .min(MODERATION_LIMITS.explanationMinLength)
  .max(MODERATION_LIMITS.noteMaxLength);

export const richNoteSchema = z.union([
  noteSchema,
  createRichTextDocumentSchema({
    maxBytes: MODERATION_LIMITS.richNoteMaxBytes,
    required: true,
  }),
]);

export const optionalExplanationSchema = z
  .string()
  .trim()
  .max(MODERATION_LIMITS.noteMaxLength)
  .nullish()
  .transform(value => (value === "" ? null : (value ?? null)));

export const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});
