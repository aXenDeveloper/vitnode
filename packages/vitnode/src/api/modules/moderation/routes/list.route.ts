import { z } from "@hono/zod-openapi";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";

import { buildRoute } from "@/api/builders";
import {
  requireModerator,
  viewableReportsCondition,
} from "@/api/lib/moderation/access";
import { findReportTarget } from "@/api/lib/moderation/registry";
import { core_moderation_reports } from "@/database/moderation";
import { containsLikePattern } from "@/lib/api/like-pattern";
import {
  MODERATION_LIMITS,
  MODERATION_REPORT_STATUSES,
} from "@/lib/moderation/const";

import { loadReportPeople } from "../lib/people";
import { queueFilters, reportTargetTriplets } from "../lib/reports";
import { json, reasonSchema, reportPersonSchema } from "../lib/schema";

const itemSchema = z.object({
  id: z.number(),
  pluginId: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  targetLabel: z.string().nullable(),
  title: z.string().nullable(),
  reason: reasonSchema,
  status: z.enum(MODERATION_REPORT_STATUSES),
  createdAt: z.date(),
  version: z.number(),
  assignee: reportPersonSchema.nullable(),
  relatedCount: z.number(),
});

const searchedReportId = (search: string): number | undefined => {
  const digits = search.replace(/^#/, "");
  const id = Number(digits);

  return /^[1-9]\d{0,9}$/.test(digits) && id <= 2_147_483_647 ? id : undefined;
};

const searchCondition = (search: string) => {
  const id = searchedReportId(search);

  return or(
    ilike(core_moderation_reports.targetTitle, containsLikePattern(search)),
    id === undefined ? undefined : eq(core_moderation_reports.id, id),
  );
};

export const listReportsRoute = buildRoute({
  route: {
    method: "get",
    path: "/reports",
    description:
      "The ModCP report queue - only reports the moderator may view, filtered before counting and paginating",
    request: {
      query: z.object({
        status: z
          .enum(["open", "new", "in_progress", "done", "all"])
          .default("open"),
        assigned: z.enum(["any", "me", "unassigned"]).default("any"),
        page: z.coerce.number().int().positive().max(10_000).default(1),
        pageSize: z.coerce
          .number()
          .int()
          .positive()
          .max(100)
          .default(MODERATION_LIMITS.queuePageSize),
        search: z.string().trim().max(200).optional(),
      }),
    },
    responses: {
      200: json(
        z.object({
          items: z.array(itemSchema),
          page: z.number(),
          pageSize: z.number(),
          total: z.number(),
        }),
        "One page of reports",
      ),
      401: { description: "Sign in first" },
      403: { description: "Not a moderator" },
    },
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    const { assigned, page, pageSize, search, status } = c.req.valid("query");
    const table = core_moderation_reports;

    const where = and(
      viewableReportsCondition(c, moderator.set),
      ...queueFilters({ assigned, status, userId: moderator.user.id }),
      search ? searchCondition(search) : undefined,
    );

    const [[totalRow], rows] = await Promise.all([
      c.get("db").select({ value: count() }).from(table).where(where),
      c
        .get("db")
        .select({
          assigneeId: table.assigneeId,
          createdAt: table.createdAt,
          id: table.id,
          pluginId: table.pluginId,
          reason: table.reason,
          targetTitle: table.targetTitle,
          status: table.status,
          targetId: table.targetId,
          targetType: table.targetType,
          version: table.version,
        })
        .from(table)
        .where(where)
        .orderBy(desc(table.createdAt), desc(table.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const related = rows.length
      ? await c
          .get("db")
          .select({
            pluginId: table.pluginId,
            targetId: table.targetId,
            targetType: table.targetType,
            value: count(),
          })
          .from(table)
          .where(
            and(
              viewableReportsCondition(c, moderator.set),
              reportTargetTriplets(rows),
            ),
          )
          .groupBy(table.pluginId, table.targetType, table.targetId)
      : [];

    const registry = c.get("core").moderation;
    const people = await loadReportPeople(
      c,
      rows.map(row => row.assigneeId),
    );

    return c.json(
      {
        items: rows.map(row => {
          const group = related.find(
            entry =>
              entry.pluginId === row.pluginId &&
              entry.targetType === row.targetType &&
              entry.targetId === row.targetId,
          );

          return {
            id: row.id,
            pluginId: row.pluginId,
            targetType: row.targetType,
            targetId: row.targetId,
            targetLabel:
              findReportTarget(registry, {
                pluginId: row.pluginId,
                type: row.targetType,
              })?.definition.label ?? null,
            title: row.targetTitle,
            reason: row.reason,
            status: row.status,
            createdAt: row.createdAt,
            version: row.version,
            assignee:
              row.assigneeId === null
                ? null
                : (people.get(row.assigneeId) ?? null),
            relatedCount: Math.max(0, (group?.value ?? 1) - 1),
          };
        }),
        page,
        pageSize,
        total: totalRow?.value ?? 0,
      },
      200,
    );
  },
});
