import { z } from "@hono/zod-openapi";

import { zodPublicPerson } from "@/api/lib/public-people";
import {
  CONTENT_SUBMISSION_DECISION_CODES,
  CONTENT_SUBMISSION_KINDS,
  CONTENT_SUBMISSION_LIMITS,
  CONTENT_SUBMISSION_STATUSES,
} from "@/content/approvals/const";

import { json } from "./moderation.schema";

const containerSchema = z.object({
  id: z.number(),
  name: z.string(),
  path: z.array(z.string()),
  slug: z.string(),
});

export const itemSchema = z.object({
  author: zodPublicPerson.nullable(),
  container: containerSchema.nullable(),
  contentTypeId: z.string(),
  createdAt: z.date(),
  decidedAt: z.date().nullable(),
  id: z.number(),
  itemId: z.string(),
  kind: z.enum(CONTENT_SUBMISSION_KINDS),
  pluginId: z.string(),
  reason: z.string().nullable(),
  reviewer: zodPublicPerson.nullable(),
  status: z.enum(CONTENT_SUBMISSION_STATUSES),
  title: z.string().nullable(),
});

export const pageSchema = z.object({
  items: z.array(itemSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
});

export const decisionErrorSchema = z.object({
  error: z.enum(CONTENT_SUBMISSION_DECISION_CODES),
  message: z.string(),
});

export const pageQuery = {
  page: z.coerce.number().int().positive().max(10_000).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(CONTENT_SUBMISSION_LIMITS.maxPageSize)
    .default(CONTENT_SUBMISSION_LIMITS.pageSize),
};

export const idParams = z.object({
  id: z.coerce.number().int().positive().openapi({ example: 1 }),
});

export const decisionResponses = {
  200: json(itemSchema.pick({ id: true, status: true }), "Decided"),
  401: { description: "Sign in first" },
  403: json(decisionErrorSchema, "The record moved out of your scope"),
  404: json(decisionErrorSchema, "No such submission in your scope"),
  409: json(
    decisionErrorSchema,
    "Already decided, the record is gone, or it changed since the proposal",
  ),
};
