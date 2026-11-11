import { and, eq, gte, lt } from "drizzle-orm";
import { z } from "zod";

import { buildRoute } from "@/api/builders";
import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "@/api/lib/with-pagination";
import { core_ai_runs } from "@/database/ai";
import { core_users } from "@/database/users";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

import { zodAiRunRow, zodAiRunStatus } from "../ai.schema";
import { runColumns, toRow } from "../lib/run-row";

export const listAiHistoryAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.ai.canView,
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
