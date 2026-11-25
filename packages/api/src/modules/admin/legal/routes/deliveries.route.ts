import { and, asc, eq, gt } from "drizzle-orm";
import { z } from "zod";

import { buildRoute } from "@/builders";
import {
  core_legal_deliveries,
  LEGAL_DELIVERY_STATUSES,
} from "@/database/legal";
import { core_users } from "@/database/users";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

import {
  zodAdminLegalDelivery,
  zodCursorQuery,
  zodVersionIdParam,
} from "../legal.schema";

const iso = (value: Date | null): null | string => value?.toISOString() ?? null;

export const deliveriesLegalAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.legal.canViewRecords,
  route: {
    method: "get",
    description:
      "The announcement email of a version per member: status, attempts, the last error and the provider's message id. Exposes member addresses.",
    path: "/versions/{id}/deliveries",
    request: {
      params: zodVersionIdParam,
      query: zodCursorQuery.extend({
        status: z.enum(LEGAL_DELIVERY_STATUSES).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              items: z.array(zodAdminLegalDelivery),
              nextCursor: z.number().int().nullable(),
            }),
          },
        },
        description: "Deliveries",
      },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const { cursor, limit, status } = c.req.valid("query");
    const rows = await c
      .get("db")
      .select({
        delivery: core_legal_deliveries,
        user: {
          email: core_users.email,
          id: core_users.id,
          name: core_users.name,
          nameCode: core_users.nameCode,
        },
      })
      .from(core_legal_deliveries)
      .innerJoin(core_users, eq(core_users.id, core_legal_deliveries.userId))
      .where(
        and(
          eq(core_legal_deliveries.versionId, id),
          status ? eq(core_legal_deliveries.status, status) : undefined,
          cursor ? gt(core_legal_deliveries.id, cursor) : undefined,
        ),
      )
      .orderBy(asc(core_legal_deliveries.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    c.header("Cache-Control", "no-store");

    return c.json(
      {
        items: page.map(({ delivery, user }) => ({
          attempts: delivery.attempts,
          id: delivery.id,
          lastAttemptAt: iso(delivery.lastAttemptAt),
          lastError: delivery.lastError,
          nextAttemptAt: delivery.nextAttemptAt.toISOString(),
          providerMessageId: delivery.providerMessageId,
          sentAt: iso(delivery.sentAt),
          skipReason: delivery.skipReason,
          status: delivery.status,
          user,
        })),
        nextCursor:
          rows.length > limit ? (page.at(-1)?.delivery.id ?? null) : null,
      },
      200,
    );
  },
});
