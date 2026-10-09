import { and, asc, eq, gte, lt } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "@/api/lib/with-pagination";
import { CONFIG_PLUGIN } from "@/config";
import {
  core_ai_calls,
  core_ai_cost_adjustments,
  core_ai_runs,
} from "@/database/ai";
import { core_users } from "@/database/users";

import { zodAiRunRow, zodAiRunStatus } from "../schemas";

const runColumns = {
  accepted: core_ai_runs.accepted,
  actionKey: core_ai_runs.actionKey,
  actorType: core_ai_runs.actorType,
  chargedPoints: core_ai_runs.chargedPoints,
  chargedUsd: core_ai_runs.chargedUsd,
  costSource: core_ai_runs.costSource,
  costUsd: core_ai_runs.costUsd,
  createdAt: core_ai_runs.createdAt,
  errorCode: core_ai_runs.errorCode,
  finishedAt: core_ai_runs.finishedAt,
  id: core_ai_runs.id,
  inputTokens: core_ai_runs.inputTokens,
  modelId: core_ai_runs.modelId,
  outputTokens: core_ai_runs.outputTokens,
  provider: core_ai_runs.provider,
  resourceId: core_ai_runs.resourceId,
  resourceType: core_ai_runs.resourceType,
  status: core_ai_runs.status,
  userId: core_users.id,
  userName: core_users.name,
  userNameCode: core_users.nameCode,
};

const toRow = ({
  userId,
  userName,
  userNameCode,
  ...run
}: Omit<z.infer<typeof zodAiRunRow>, "user"> & {
  userId: null | number;
  userName: null | string;
  userNameCode: null | string;
}) => ({
  ...run,
  user:
    userId === null
      ? null
      : { id: userId, name: userName ?? "", nameCode: userNameCode ?? "" },
});

export const listAiHistoryAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "ai", permission: "can_view" },
  route: {
    method: "get",
    description:
      "AI runs, newest first, filtered by date, action, actor, model and status.",
    path: "/history",
    request: {
      query: zodPaginationQuery.extend({
        action: z.string().optional(),
        actorType: z.enum(["system", "user"]).optional(),
        from: z.coerce.date().optional(),
        modelId: z.string().optional(),
        order: z.enum(["asc", "desc"]).optional(),
        status: zodAiRunStatus.optional(),
        to: z.coerce.date().optional(),
        userId: z.coerce.number().int().optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              edges: z.array(zodAiRunRow),
              pageInfo: zodPaginationPageInfo,
            }),
          },
        },
        description: "AI runs",
      },
    },
  },
  handler: async c => {
    const query = c.req.valid("query");
    const filters = and(
      query.action ? eq(core_ai_runs.actionKey, query.action) : undefined,
      query.actorType ? eq(core_ai_runs.actorType, query.actorType) : undefined,
      query.from ? gte(core_ai_runs.createdAt, query.from) : undefined,
      query.to ? lt(core_ai_runs.createdAt, query.to) : undefined,
      query.modelId ? eq(core_ai_runs.modelId, query.modelId) : undefined,
      query.status ? eq(core_ai_runs.status, query.status) : undefined,
      query.userId ? eq(core_ai_runs.userId, query.userId) : undefined,
    );

    const data = await withPagination({
      params: { query },
      c,
      primaryCursor: core_ai_runs.id,
      where: filters,
      query: async ({ cursorSelection, limit, offset, where, orderBy }) =>
        await c
          .get("db")
          .select({ ...cursorSelection, ...runColumns })
          .from(core_ai_runs)
          .leftJoin(core_users, eq(core_users.id, core_ai_runs.userId))
          .where(where)
          .orderBy(orderBy)
          .limit(limit)
          .offset(offset),
      table: core_ai_runs,
      orderBy: { column: core_ai_runs.createdAt, order: query.order ?? "desc" },
    });

    return c.json({ ...data, edges: data.edges.map(toRow) });
  },
});

export const showAiRunAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "ai", permission: "can_view" },
  route: {
    method: "get",
    description:
      "One AI run with every provider call and cost adjustment. Prompts and outputs are not stored.",
    path: "/history/{id}",
    request: { params: z.object({ id: z.coerce.number().int() }) },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              adjustments: z.array(
                z.object({
                  createdAt: z.date(),
                  deltaUsd: z.string(),
                  id: z.number(),
                  newCostUsd: z.string(),
                  newSource: z.string(),
                  previousCostUsd: z.string().nullable(),
                  previousSource: z.string(),
                  reason: z.string(),
                }),
              ),
              calls: z.array(
                z.object({
                  attempt: z.number(),
                  cacheReadTokens: z.number().nullable(),
                  cacheWriteTokens: z.number().nullable(),
                  costReason: z.string().nullable(),
                  costSource: z.string(),
                  costUsd: z.string().nullable(),
                  errorCode: z.string().nullable(),
                  finishedAt: z.date().nullable(),
                  id: z.number(),
                  images: z.number(),
                  inputTokens: z.number().nullable(),
                  modelId: z.string(),
                  outputTokens: z.number().nullable(),
                  pricingVersion: z.string().nullable(),
                  provider: z.string(),
                  providerModelId: z.string().nullable(),
                  providerRequestId: z.string().nullable(),
                  reasoningTokens: z.number().nullable(),
                  startedAt: z.date(),
                  status: z.string(),
                }),
              ),
              run: zodAiRunRow.extend({
                promptVersion: z.number(),
                reservedPoints: z.string(),
                reservedUsd: z.string(),
                settlement: z.string(),
              }),
            }),
          },
        },
        description: "AI run details",
      },
      404: { description: "No such run" },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const db = c.get("db");
    const [run] = await db
      .select({
        ...runColumns,
        promptVersion: core_ai_runs.promptVersion,
        reservedPoints: core_ai_runs.reservedPoints,
        reservedUsd: core_ai_runs.reservedUsd,
        settlement: core_ai_runs.settlement,
      })
      .from(core_ai_runs)
      .leftJoin(core_users, eq(core_users.id, core_ai_runs.userId))
      .where(eq(core_ai_runs.id, id))
      .limit(1);
    if (!run) throw new HTTPException(404, { message: "AI run not found" });

    const [calls, adjustments] = await Promise.all([
      db
        .select({
          attempt: core_ai_calls.attempt,
          cacheReadTokens: core_ai_calls.cacheReadTokens,
          cacheWriteTokens: core_ai_calls.cacheWriteTokens,
          costReason: core_ai_calls.costReason,
          costSource: core_ai_calls.costSource,
          costUsd: core_ai_calls.costUsd,
          errorCode: core_ai_calls.errorCode,
          finishedAt: core_ai_calls.finishedAt,
          id: core_ai_calls.id,
          images: core_ai_calls.images,
          inputTokens: core_ai_calls.inputTokens,
          modelId: core_ai_calls.modelId,
          outputTokens: core_ai_calls.outputTokens,
          pricingVersion: core_ai_calls.pricingVersion,
          provider: core_ai_calls.provider,
          providerModelId: core_ai_calls.providerModelId,
          providerRequestId: core_ai_calls.providerRequestId,
          reasoningTokens: core_ai_calls.reasoningTokens,
          startedAt: core_ai_calls.startedAt,
          status: core_ai_calls.status,
        })
        .from(core_ai_calls)
        .where(eq(core_ai_calls.runId, id))
        .orderBy(asc(core_ai_calls.id)),
      db
        .select({
          createdAt: core_ai_cost_adjustments.createdAt,
          deltaUsd: core_ai_cost_adjustments.deltaUsd,
          id: core_ai_cost_adjustments.id,
          newCostUsd: core_ai_cost_adjustments.newCostUsd,
          newSource: core_ai_cost_adjustments.newSource,
          previousCostUsd: core_ai_cost_adjustments.previousCostUsd,
          previousSource: core_ai_cost_adjustments.previousSource,
          reason: core_ai_cost_adjustments.reason,
        })
        .from(core_ai_cost_adjustments)
        .where(eq(core_ai_cost_adjustments.runId, id))
        .orderBy(asc(core_ai_cost_adjustments.id)),
    ]);

    return c.json({ adjustments, calls, run: toRow(run) }, 200);
  },
});
