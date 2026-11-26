import { z } from "@hono/zod-openapi";
import { count, gte, sql } from "drizzle-orm";

import { buildRoute } from "@/builders";
import { core_users } from "@/database/users";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

const DAY_MS = 86_400_000;

export const SIGN_UP_RANGES = ["7", "14", "30"] as const;

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

export const zodSignUps = z.object({
  days: z.array(z.object({ count: z.number(), day: z.string() })),
  total: z.number(),
});

export const signUpsAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.users.canView,
  route: {
    method: "get",
    description:
      "Sign-ups per UTC day for the last `days` days and the period before them, oldest first, plus the total member count, for the dashboard's New members widget (Admin only)",
    path: "/sign-ups",
    request: {
      query: z.object({
        days: z.enum(SIGN_UP_RANGES).default("14"),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: zodSignUps } },
        description: "Daily sign-ups",
      },
    },
  },
  handler: async c => {
    const db = c.get("db");
    const days = Number(c.req.valid("query").days);
    const today = new Date(`${dayKey(new Date())}T00:00:00.000Z`);
    const start = new Date(today.getTime() - (days * 2 - 1) * DAY_MS);
    const bucket = sql<string>`to_char(date_trunc('day', ${core_users.createdAt}), 'YYYY-MM-DD')`;

    const [rows, [all]] = await Promise.all([
      db
        .select({ day: bucket, total: count() })
        .from(core_users)
        .where(gte(core_users.createdAt, start))
        .groupBy(bucket),
      db.select({ total: count() }).from(core_users),
    ]);
    const byDay = new Map(rows.map(row => [row.day, row.total]));

    return c.json(
      {
        days: Array.from({ length: days * 2 }, (_, index) => {
          const day = dayKey(new Date(start.getTime() + index * DAY_MS));

          return { count: byDay.get(day) ?? 0, day };
        }),
        total: all?.total ?? 0,
      },
      200,
    );
  },
});
