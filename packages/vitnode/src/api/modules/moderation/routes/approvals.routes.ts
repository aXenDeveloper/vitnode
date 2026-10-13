import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { requireModerator } from "@/api/lib/moderation/access";
import { zodPublicPerson } from "@/api/lib/public-people";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import {
  CONTENT_SUBMISSION_DECISION_CODES,
  CONTENT_SUBMISSION_KINDS,
  CONTENT_SUBMISSION_LIMITS,
  CONTENT_SUBMISSION_STATUSES,
} from "@/content/approvals/const";
import {
  ContentSubmissionDecisionError,
  decideContentSubmission,
} from "@/content/approvals/server/decide";
import {
  canReviewSubmission,
  contentSubmissionFilters,
  findContentSubmission,
  listAuthorContentSubmissions,
  listContentSubmissions,
  reviewableContentTypes,
  showContentSubmission,
} from "@/content/approvals/server/queue";

import { json } from "../lib/schema";

const containerSchema = z.object({
  id: z.number(),
  name: z.string(),
  path: z.array(z.string()),
  slug: z.string(),
});

const itemSchema = z.object({
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

const pageSchema = z.object({
  items: z.array(itemSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
});

const detailSchema = itemSchema.extend({
  baseValues: z.record(z.string(), z.unknown()).nullable(),
  current: z.record(z.string(), z.unknown()).nullable(),
  fields: z.array(z.object({ kind: z.string(), name: z.string() })),
  history: z.array(itemSchema),
  record: z.object({
    exists: z.boolean(),
    public: z.boolean(),
    slug: z.string().nullable(),
    url: z.string().nullable(),
  }),
  values: z.record(z.string(), z.unknown()),
});

const decisionErrorSchema = z.object({
  error: z.enum(CONTENT_SUBMISSION_DECISION_CODES),
  message: z.string(),
});

const pageQuery = {
  page: z.coerce.number().int().positive().max(10_000).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(CONTENT_SUBMISSION_LIMITS.maxPageSize)
    .default(CONTENT_SUBMISSION_LIMITS.pageSize),
};

const idParams = z.object({
  id: z.coerce.number().int().positive().openapi({ example: 1 }),
});

const decisionError = (error: unknown): never => {
  if (error instanceof ContentSubmissionDecisionError) {
    throw new HTTPException(error.status, {
      res: Response.json(
        { error: error.code, message: error.message },
        { status: error.status },
      ),
    });
  }

  throw error;
};

/** 404 for a submission the moderator may not review - its existence is not theirs to know. */
const reviewableSubmission = async (c: Context, id: number) => {
  const moderator = await requireModerator(c);
  const row = await findContentSubmission(c, id);
  if (
    !row ||
    !canReviewSubmission(await reviewableContentTypes(c, moderator.set), row)
  ) {
    throw new HTTPException(404, {
      res: Response.json(
        { error: "notFound", message: "No such submission." },
        { status: 404 },
      ),
    });
  }

  return { moderator, row };
};

export const listApprovalsRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    path: "/approvals",
    description:
      "The approval queue - only submissions in containers where the moderator holds `can_approve`",
    request: {
      query: z.object({
        ...pageQuery,
        status: z.enum(CONTENT_SUBMISSION_STATUSES).default("pending"),
        contentTypeId: z.string().max(100).optional(),
        containerId: z.coerce.number().int().positive().optional(),
      }),
    },
    responses: {
      200: json(pageSchema, "One page of submissions"),
      401: { description: "Sign in first" },
      403: { description: "Not a moderator" },
    },
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    const query = c.req.valid("query");
    const { items, total } = await listContentSubmissions(
      c,
      moderator.set,
      query,
    );

    return c.json(
      { items, page: query.page, pageSize: query.pageSize, total },
      200,
      { "Cache-Control": "private, no-store" },
    );
  },
});

export const approvalFiltersRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    path: "/approvals/filters",
    description:
      "Content types and containers the moderator may review, for the queue filters",
    responses: {
      200: json(
        z.object({
          containers: z.array(
            z.object({
              definitionId: z.string(),
              depth: z.number(),
              id: z.number(),
              name: z.string(),
            }),
          ),
          contentTypes: z.array(
            z.object({ id: z.string(), pluginId: z.string() }),
          ),
        }),
        "Filter options",
      ),
      401: { description: "Sign in first" },
      403: { description: "Not a moderator" },
    },
  },
  handler: async c => {
    const moderator = await requireModerator(c);

    return c.json(await contentSubmissionFilters(c, moderator.set), 200, {
      "Cache-Control": "private, no-store",
    });
  },
});

export const myApprovalsRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    path: "/approvals/mine",
    description:
      "The signed-in member's own submissions and what happened to them",
    request: { query: z.object(pageQuery) },
    responses: {
      200: json(pageSchema, "One page of the member's submissions"),
      401: { description: "Sign in first" },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "Sign in first." });
    const query = c.req.valid("query");
    const { items, total } = await listAuthorContentSubmissions(
      c,
      user.id,
      query,
    );

    return c.json(
      { items, page: query.page, pageSize: query.pageSize, total },
      200,
      { "Cache-Control": "private, no-store" },
    );
  },
});

export const showApprovalRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    path: "/approvals/{id}",
    description:
      "One submission with the proposed values, the live record to compare with, and its history",
    request: { params: idParams },
    responses: {
      200: json(detailSchema, "The submission"),
      401: { description: "Sign in first" },
      403: { description: "Not a moderator" },
      404: json(decisionErrorSchema, "No such submission in your scope"),
    },
  },
  handler: async c => {
    const { row } = await reviewableSubmission(c, c.req.valid("param").id);

    return c.json(await showContentSubmission(c, row), 200, {
      "Cache-Control": "private, no-store",
    });
  },
});

const decisionResponses = {
  200: json(itemSchema.pick({ id: true, status: true }), "Decided"),
  401: { description: "Sign in first" },
  403: json(decisionErrorSchema, "The record moved out of your scope"),
  404: json(decisionErrorSchema, "No such submission in your scope"),
  409: json(
    decisionErrorSchema,
    "Already decided, the record is gone, or it changed since the proposal",
  ),
};

export const approveApprovalRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    path: "/approvals/{id}/approve",
    description:
      "Approve a submission: publish the new record, or apply the proposed edit",
    request: { params: idParams },
    responses: decisionResponses,
  },
  handler: async c => {
    const { moderator, row } = await reviewableSubmission(
      c,
      c.req.valid("param").id,
    );

    try {
      const decided = await decideContentSubmission(c, {
        decision: "approve",
        id: row.id,
        reviewerId: moderator.user.id,
      });

      return c.json({ id: decided.id, status: decided.status }, 200);
    } catch (error) {
      return decisionError(error);
    }
  },
});

export const rejectApprovalRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    path: "/approvals/{id}/reject",
    description:
      "Reject a submission. The record stays as it is: a new one stays unpublished, a published one keeps its live version",
    request: {
      params: idParams,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              reason: z
                .string()
                .trim()
                .max(CONTENT_SUBMISSION_LIMITS.reasonMaxLength)
                .nullable()
                .optional(),
            }),
          },
        },
      },
    },
    responses: decisionResponses,
  },
  handler: async c => {
    const { moderator, row } = await reviewableSubmission(
      c,
      c.req.valid("param").id,
    );
    const { reason } = c.req.valid("json");

    try {
      const decided = await decideContentSubmission(c, {
        decision: "reject",
        id: row.id,
        reason: reason === "" ? null : (reason ?? null),
        reviewerId: moderator.user.id,
      });

      return c.json({ id: decided.id, status: decided.status }, 200);
    } catch (error) {
      return decisionError(error);
    }
  },
});
