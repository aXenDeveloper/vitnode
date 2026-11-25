import { and, asc, eq, gt } from "drizzle-orm";
import { z } from "zod";

import { buildRoute } from "@/builders";
import { core_legal_acceptances } from "@/database/legal";
import { core_users } from "@/database/users";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

import {
  zodAdminLegalAcceptance,
  zodCursorQuery,
  zodVersionIdParam,
} from "../legal.schema";

export const acceptancesLegalAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.legal.canViewRecords,
  route: {
    method: "get",
    description:
      "Members who accepted exactly this Terms version, with the time and the language of the text they saw.",
    path: "/versions/{id}/acceptances",
    request: { params: zodVersionIdParam, query: zodCursorQuery },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              items: z.array(zodAdminLegalAcceptance),
              nextCursor: z.number().int().nullable(),
            }),
          },
        },
        description: "Acceptances",
      },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const { cursor, limit } = c.req.valid("query");
    const rows = await c
      .get("db")
      .select({
        acceptance: core_legal_acceptances,
        user: {
          id: core_users.id,
          name: core_users.name,
          nameCode: core_users.nameCode,
        },
      })
      .from(core_legal_acceptances)
      .innerJoin(core_users, eq(core_users.id, core_legal_acceptances.userId))
      .where(
        and(
          eq(core_legal_acceptances.versionId, id),
          cursor ? gt(core_legal_acceptances.id, cursor) : undefined,
        ),
      )
      .orderBy(asc(core_legal_acceptances.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    c.header("Cache-Control", "no-store");

    return c.json(
      {
        items: page.map(({ acceptance, user }) => ({
          acceptedAt: acceptance.acceptedAt.toISOString(),
          id: acceptance.id,
          locale: acceptance.locale,
          source: acceptance.source,
          user,
        })),
        nextCursor:
          rows.length > limit ? (page.at(-1)?.acceptance.id ?? null) : null,
      },
      200,
    );
  },
});
