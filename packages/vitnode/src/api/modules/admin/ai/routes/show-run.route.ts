import { asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/builders";
import {
  core_ai_calls,
  core_ai_cost_adjustments,
  core_ai_runs,
} from "@/database/ai";
import { core_users } from "@/database/users";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

import { zodAiRunRow } from "../ai.schema";
import { runColumns, toRow } from "../lib/run-row";

export const showAiRunAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.ai.canView,
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
