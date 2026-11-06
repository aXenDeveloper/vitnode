import { z } from "@hono/zod-openapi";

import {
  createRichTextDocumentSchema,
  isRichTextEmpty,
  zodRichTextDocument,
} from "@/content/rich-text/document";
import { richTextToPlainText } from "@/content/rich-text/plain-text";
import {
  MODERATION_LIMITS,
  MODERATION_REPORT_EVENT_TYPES,
  MODERATION_REPORT_RESOLUTIONS,
  MODERATION_REPORT_STATUSES,
} from "@/lib/moderation/const";
import { WARNING_LIMITS } from "@/lib/moderation/warnings";

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

const warningDocumentSchema = createRichTextDocumentSchema({
  maxBytes: WARNING_LIMITS.documentMaxBytes,
});

export const warningMessageInputSchema = z
  .array(
    z.object({
      languageCode: z.string().min(1).max(20),
      value: warningDocumentSchema,
    }),
  )
  .min(1)
  .superRefine((items, ctx) => {
    const codes = new Set<string>();
    items.forEach((item, index) => {
      if (codes.has(item.languageCode)) {
        ctx.addIssue({
          code: "custom",
          message: "duplicate_language",
          path: [index, "languageCode"],
        });
      }
      codes.add(item.languageCode);
      const length = richTextToPlainText(item.value).length;
      if (
        length < WARNING_LIMITS.messageMinLength ||
        length > WARNING_LIMITS.messageMaxLength
      ) {
        ctx.addIssue({
          code: "custom",
          message: "message_length",
          path: [index, "value"],
        });
      }
    });
  });

export const warningStaffNoteInputSchema = warningDocumentSchema
  .nullish()
  .transform(value => (value && !isRichTextEmpty(value) ? value : null))
  .refine(
    value =>
      !value ||
      richTextToPlainText(value).length <= WARNING_LIMITS.noteMaxLength,
    { message: "note_length" },
  );

export const warningMessageSchema = z.array(
  z.object({ languageCode: z.string(), value: zodRichTextDocument }),
);

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
