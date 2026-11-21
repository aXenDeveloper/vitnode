import { z } from "@hono/zod-openapi";
import { and, eq, exists, ilike, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { buildRoute } from "@/builders";
import {
  ACCOUNT_DELETION_SOURCES,
  ACCOUNT_DELETION_STATUSES,
  core_users_deletions,
} from "@/database/account-deletions";
import { core_users } from "@/database/users";
import { eraseAccount } from "@/lib/account-deletion/erase";
import { cancelAccountDeletion } from "@/lib/account-deletion/requests";
import { containsLikePattern } from "@/lib/api/like-pattern";
import { writeAuditLogBestEffort } from "@/lib/audit/write";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "@/lib/with-pagination";

const requester = alias(core_users, "deletion_requester");

/** The known values of a comma-separated query parameter. */
const pickListed = <T extends string>(
  raw: string | undefined,
  known: readonly T[],
): T[] =>
  (raw?.split(",") ?? []).filter((value): value is T =>
    (known as readonly string[]).includes(value),
  );

const zodDeletionId = z.object({
  deletionId: z
    .string()
    .regex(/^[1-9]\d{0,9}$/)
    .openapi({ example: "1" }),
});

const notFound = {
  content: {
    "application/json": { schema: z.object({ error: z.string() }) },
  },
  description: "No such request in a state that allows this",
};

export const listAccountDeletionsAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.users.canView,
  route: {
    method: "get",
    description:
      "Account deletion requests: pending ones with their due date, failed ones with the reason, completed ones as proof of erasure. Filter by `status` and `source` (comma-separated) and `search` by name, email, #id or DR-0042 (Admin only)",
    path: "/account-deletions",
    request: {
      query: zodPaginationQuery.extend({
        order: z.enum(["asc", "desc"]).optional(),
        orderBy: z.enum(["createdAt", "scheduledAt"]).optional(),
        search: z.string().max(100).optional(),
        source: z.string().max(32).optional(),
        status: z.string().max(64).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              edges: z.array(
                z.object({
                  id: z.number(),
                  erasedUserId: z.number(),
                  user: z
                    .object({
                      id: z.number(),
                      name: z.string(),
                      nameCode: z.string(),
                    })
                    .nullable(),
                  requestedBy: z
                    .object({ id: z.number(), name: z.string() })
                    .nullable(),
                  source: z.enum(ACCOUNT_DELETION_SOURCES),
                  status: z.enum(ACCOUNT_DELETION_STATUSES),
                  scheduledAt: z.date(),
                  createdAt: z.date(),
                  completedAt: z.date().nullable(),
                  cancelledAt: z.date().nullable(),
                  attempts: z.number(),
                  lastError: z.string().nullable(),
                  filesDeleted: z.number(),
                  filesKept: z.number(),
                }),
              ),
              pageInfo: zodPaginationPageInfo,
            }),
          },
        },
        description: "Account deletion requests",
      },
    },
  },
  handler: async c => {
    const query = c.req.valid("query");
    const statuses = pickListed(query.status, ACCOUNT_DELETION_STATUSES);
    const sources = pickListed(query.source, ACCOUNT_DELETION_SOURCES);
    const term = query.search?.trim() ?? "";
    const ref = /^(?:dr-?)?0*(\d{1,9})$/i.exec(term.replace(/^#/, ""));
    const pattern = containsLikePattern(term);

    const data = await withPagination({
      params: { query: { ...query, search: undefined } },
      where: and(
        statuses.length
          ? inArray(core_users_deletions.status, statuses)
          : undefined,
        sources.length
          ? inArray(core_users_deletions.source, sources)
          : undefined,
        term
          ? or(
              exists(
                c
                  .get("db")
                  .select({ one: sql`1` })
                  .from(core_users)
                  .where(
                    and(
                      eq(core_users.id, core_users_deletions.userId),
                      or(
                        ilike(core_users.name, pattern),
                        ilike(core_users.nameCode, pattern),
                        ilike(core_users.email, pattern),
                      ),
                    ),
                  ),
              ),
              ref
                ? or(
                    eq(core_users_deletions.id, Number(ref[1])),
                    eq(core_users_deletions.erasedUserId, Number(ref[1])),
                  )
                : undefined,
            )
          : undefined,
      ),
      primaryCursor: core_users_deletions.id,
      query: async ({ cursorSelection, limit, offset, where, orderBy }) =>
        await c
          .get("db")
          .select({
            ...cursorSelection,
            id: core_users_deletions.id,
            erasedUserId: core_users_deletions.erasedUserId,
            userId: core_users.id,
            userName: core_users.name,
            userNameCode: core_users.nameCode,
            requestedById: requester.id,
            requestedByName: requester.name,
            source: core_users_deletions.source,
            status: core_users_deletions.status,
            scheduledAt: core_users_deletions.scheduledAt,
            createdAt: core_users_deletions.createdAt,
            completedAt: core_users_deletions.completedAt,
            cancelledAt: core_users_deletions.cancelledAt,
            attempts: core_users_deletions.attempts,
            lastError: core_users_deletions.lastError,
            filesDeleted: core_users_deletions.filesDeleted,
            filesKept: core_users_deletions.filesKept,
          })
          .from(core_users_deletions)
          .leftJoin(core_users, eq(core_users.id, core_users_deletions.userId))
          .leftJoin(
            requester,
            eq(requester.id, core_users_deletions.requestedById),
          )
          .where(where)
          .orderBy(orderBy)
          .limit(limit)
          .offset(offset),
      table: core_users_deletions,
      orderBy: {
        column: core_users_deletions[query.orderBy ?? "createdAt"],
        order: query.order ?? "desc",
      },
      c,
    });

    return c.json(
      {
        pageInfo: data.pageInfo,
        edges: data.edges.map(
          ({
            requestedById,
            requestedByName,
            userId,
            userName,
            userNameCode,
            ...row
          }) => ({
            ...row,
            user:
              userId !== null && userName !== null && userNameCode !== null
                ? { id: userId, name: userName, nameCode: userNameCode }
                : null,
            requestedBy:
              requestedById !== null && requestedByName !== null
                ? { id: requestedById, name: requestedByName }
                : null,
          }),
        ),
      },
      200,
    );
  },
});

export const retryAccountDeletionAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.users.canDelete,
  route: {
    method: "post",
    description:
      "Run a failed or pending account erasure again now (Admin only)",
    path: "/account-deletions/{deletionId}/retry",
    request: { params: zodDeletionId },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ status: z.enum(["completed", "failed"]) }),
          },
        },
        description: "The erasure ran",
      },
      403: { description: "Access Denied" },
      404: notFound,
    },
  },
  handler: async c => {
    const deletionId = Number(c.req.valid("param").deletionId);

    const [row] = await c
      .get("db")
      .update(core_users_deletions)
      .set({ attempts: 0, scheduledAt: new Date(), status: "pending" })
      .where(
        and(
          eq(core_users_deletions.id, deletionId),
          inArray(core_users_deletions.status, ["failed", "pending"]),
        ),
      )
      .returning({
        status: core_users_deletions.status,
        userId: core_users_deletions.userId,
      });

    if (!row?.userId) {
      return c.json({ error: "No account is waiting for this request" }, 404);
    }

    const result = await eraseAccount(c, {
      deletionId,
      userId: row.userId,
    });

    return c.json(
      { status: result.status === "failed" ? "failed" : "completed" },
      200,
    );
  },
});

export const cancelAccountDeletionAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.users.canDelete,
  route: {
    method: "delete",
    description:
      "Cancel a pending account deletion; the account stays (Admin only)",
    path: "/account-deletions/{deletionId}",
    request: { params: zodDeletionId },
    responses: {
      200: { description: "Deletion cancelled" },
      403: { description: "Access Denied" },
      404: notFound,
    },
  },
  handler: async c => {
    const deletionId = Number(c.req.valid("param").deletionId);

    const [row] = await c
      .get("db")
      .select({ userId: core_users_deletions.userId })
      .from(core_users_deletions)
      .where(
        and(
          eq(core_users_deletions.id, deletionId),
          eq(core_users_deletions.status, "pending"),
        ),
      )
      .limit(1);

    if (!row?.userId || !(await cancelAccountDeletion(c, row.userId))) {
      return c.json({ error: "No pending request" }, 404);
    }

    await writeAuditLogBestEffort(c, {
      action: "user.deletion_cancelled",
      target: { id: row.userId, type: "user" },
    });

    return c.body(null, 200);
  },
});
