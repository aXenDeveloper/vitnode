import { z } from "@hono/zod-openapi";
import {
  and,
  count,
  desc,
  eq,
  gt,
  gte,
  isNotNull,
  isNull,
  lte,
  or,
} from "drizzle-orm";

import { buildRoute } from "@/api/builders";
import { requireModerator } from "@/api/lib/moderation/access";
import {
  hasWarningPermission,
  viewableWarningsCondition,
} from "@/api/lib/moderation/warnings/access";
import { core_moderation_warnings } from "@/database/warnings";
import { WARNING_LIMITS, WARNING_PERMISSIONS } from "@/lib/moderation/warnings";

import { loadReportPeople } from "../lib/people";
import {
  serializeStaffWarnings,
  staffWarningSchema,
} from "../lib/warnings-view";
import { json, reportPersonSchema } from "../moderation.schema";
import { commonResponses } from "../warnings.schema";

const statusCondition = (
  status: "active" | "all" | "expired" | "revoked",
  now: Date,
) => {
  const table = core_moderation_warnings;
  switch (status) {
    case "active":
      return and(
        isNull(table.revokedAt),
        or(isNull(table.expiresAt), gt(table.expiresAt, now)),
      );
    case "all":
      return undefined;
    case "expired":
      return and(isNull(table.revokedAt), lte(table.expiresAt, now));
    case "revoked":
      return isNotNull(table.revokedAt);
  }
};

export const listWarningsRoute = buildRoute({
  route: {
    method: "get",
    path: "/warnings",
    description:
      "Warnings the moderator may see, newest first, with filters. Moderators without `can_view` see the warnings they issued and those linked to content in their scope",
    request: {
      query: z.object({
        userId: z.coerce.number().int().positive().optional(),
        reasonId: z.coerce.number().int().positive().optional(),
        issuedById: z.coerce.number().int().positive().optional(),
        status: z.enum(["all", "active", "expired", "revoked"]).default("all"),
        pluginId: z.string().max(100).optional(),
        targetType: z.string().max(100).optional(),
        from: z.iso.datetime().optional(),
        to: z.iso.datetime().optional(),
        page: z.coerce.number().int().positive().max(10_000).default(1),
        pageSize: z.coerce
          .number()
          .int()
          .positive()
          .max(100)
          .default(WARNING_LIMITS.pageSize),
      }),
    },
    responses: {
      200: json(
        z.object({
          items: z.array(
            staffWarningSchema.extend({ user: reportPersonSchema.nullable() }),
          ),
          page: z.number(),
          pageSize: z.number(),
          total: z.number(),
          permissions: z.object({
            revoke: z.boolean(),
            warn: z.boolean(),
          }),
        }),
        "One page of warnings",
      ),
      401: commonResponses[401],
      403: { description: "Not a moderator" },
    },
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    const query = c.req.valid("query");
    const table = core_moderation_warnings;
    const now = new Date();
    const where = and(
      viewableWarningsCondition(c, moderator),
      statusCondition(query.status, now),
      query.userId ? eq(table.userId, query.userId) : undefined,
      query.reasonId ? eq(table.reasonId, query.reasonId) : undefined,
      query.issuedById ? eq(table.issuedById, query.issuedById) : undefined,
      query.pluginId ? eq(table.pluginId, query.pluginId) : undefined,
      query.targetType ? eq(table.targetType, query.targetType) : undefined,
      query.from ? gte(table.issuedAt, new Date(query.from)) : undefined,
      query.to ? lte(table.issuedAt, new Date(query.to)) : undefined,
    );

    const [[totalRow], rows] = await Promise.all([
      c.get("db").select({ value: count() }).from(table).where(where),
      c
        .get("db")
        .select()
        .from(table)
        .where(where)
        .orderBy(desc(table.issuedAt), desc(table.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
    ]);
    const [items, people] = await Promise.all([
      serializeStaffWarnings(c, moderator, rows, now),
      loadReportPeople(
        c,
        rows.map(row => row.userId),
      ),
    ]);

    return c.json(
      {
        items: items.map(item => ({
          ...item,
          user: people.get(item.userId) ?? null,
        })),
        page: query.page,
        pageSize: query.pageSize,
        total: totalRow?.value ?? 0,
        permissions: {
          revoke: hasWarningPermission(
            moderator.set,
            WARNING_PERMISSIONS.revoke,
          ),
          warn: hasWarningPermission(moderator.set, WARNING_PERMISSIONS.warn),
        },
      },
      200,
    );
  },
});
