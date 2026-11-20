import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { z } from "@hono/zod-openapi";
import { and, eq, exists, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { buildRoute } from "@/builders";
import { core_users_deletions } from "@/database/account-deletions";
import { core_files } from "@/database/files";
import { core_roles } from "@/database/roles";
import { core_users, core_users_secondary_roles } from "@/database/users";
import { OPEN_ACCOUNT_DELETION_STATUSES } from "@/lib/account-deletion/requests";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { resolveRoleNames } from "@/lib/resolve-role-names";
import { storageUrlOf } from "@/lib/storage-url";
import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "@/lib/with-pagination";

const avatarFile = alias(core_files, "user_avatar_file");

/** One column of the user's newest open deletion request, as a scalar subquery. */
const openDeletion = (column: AnyPgColumn) =>
  sql`select ${column} from ${core_users_deletions} where ${core_users_deletions.userId} = ${core_users.id} and ${core_users_deletions.status} in ('pending', 'failed') order by ${core_users_deletions.createdAt} desc limit 1`;

export const listUsersAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.users.canView,
  route: {
    method: "get",
    description: "Get list of all users",
    path: "/list",
    request: {
      query: zodPaginationQuery.extend({
        order: z.enum(["asc", "desc"]).optional(),
        orderBy: z.enum(["name", "createdAt"]).optional(),
        roleId: z.string().optional(),
        search: z.string().optional(),
        /** Comma-separated: `pending`, `failed` - members with such an open deletion request. */
        deletion: z.string().optional(),
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
                  name: z.string(),
                  email: z.string(),
                  nameCode: z.string(),
                  createdAt: z.date(),
                  newsletter: z.boolean(),
                  avatarColor: z.string(),
                  avatarUrl: z.string().nullable(),
                  emailVerified: z.boolean(),
                  roleId: z.number(),
                  role: z.object({
                    id: z.number(),
                    color: z.string().nullable(),
                    prefix: z.string().nullable(),
                    name: z.array(
                      z.object({
                        name: z.string(),
                        languageCode: z.string(),
                      }),
                    ),
                  }),
                  secondaryRoles: z.array(
                    z.object({
                      id: z.number(),
                      color: z.string().nullable(),
                      prefix: z.string().nullable(),
                      name: z.array(
                        z.object({
                          name: z.string(),
                          languageCode: z.string(),
                        }),
                      ),
                    }),
                  ),
                  birthday: z.date().nullable(),
                  language: z.string(),
                  /** The open deletion request, if any. */
                  deletion: z
                    .object({
                      scheduledAt: z.date(),
                      status: z.enum(OPEN_ACCOUNT_DELETION_STATUSES),
                    })
                    .nullable(),
                }),
              ),
              pageInfo: zodPaginationPageInfo,
            }),
          },
        },
        description: "List of users",
      },
    },
  },
  handler: async c => {
    const query = c.req.valid("query");
    const roleIds = (query.roleId?.split(",") ?? [])
      .filter(Boolean)
      .map(id => Number(id))
      .filter(id => !Number.isNaN(id));
    const deletionStatuses = (query.deletion?.split(",") ?? []).filter(
      (status): status is (typeof OPEN_ACCOUNT_DELETION_STATUSES)[number] =>
        (OPEN_ACCOUNT_DELETION_STATUSES as readonly string[]).includes(status),
    );
    const data = await withPagination({
      params: {
        query,
      },
      search: [core_users.name, core_users.email, core_users.nameCode],
      where: and(
        roleIds.length ? inArray(core_users.roleId, roleIds) : undefined,
        deletionStatuses.length
          ? exists(
              c
                .get("db")
                .select({ one: sql`1` })
                .from(core_users_deletions)
                .where(
                  and(
                    eq(core_users_deletions.userId, core_users.id),
                    inArray(core_users_deletions.status, deletionStatuses),
                  ),
                ),
            )
          : undefined,
      ),
      primaryCursor: core_users.id,
      query: async ({ cursorSelection, limit, offset, where, orderBy }) =>
        await c
          .get("db")
          .select({
            ...cursorSelection,
            id: core_users.id,
            name: core_users.name,
            email: core_users.email,
            nameCode: core_users.nameCode,
            createdAt: core_users.createdAt,
            newsletter: core_users.newsletter,
            avatarColor: core_users.avatarColor,
            emailVerified: core_users.emailVerified,
            roleId: core_users.roleId,
            roleColor: core_roles.color,
            rolePrefix: core_roles.prefix,
            birthday: core_users.birthday,
            language: core_users.language,
            avatarKey: avatarFile.key,
            deletionStatus: sql<
              null | string
            >`(${openDeletion(core_users_deletions.status)})`,
            deletionScheduledAt:
              sql<Date | null>`(${openDeletion(core_users_deletions.scheduledAt)})`.mapWith(
                core_users_deletions.scheduledAt,
              ),
          })
          .from(core_users)
          .leftJoin(core_roles, eq(core_roles.id, core_users.roleId))
          .leftJoin(avatarFile, eq(avatarFile.id, core_users.avatarId))
          .where(where)
          .orderBy(orderBy)
          .limit(limit)
          .offset(offset),
      table: core_users,
      orderBy: {
        column: query.orderBy
          ? core_users[query.orderBy]
          : core_users.createdAt,
        order: query.order ?? "desc",
      },
      c,
    });

    // Secondary roles are a user<->role join, so collect every assignment for
    // the listed users in a single query (with the role color alongside).
    const userIds = data.edges.map(user => user.id);
    const secondaryRoleRows = userIds.length
      ? await c
          .get("db")
          .select({
            userId: core_users_secondary_roles.userId,
            roleId: core_users_secondary_roles.roleId,
            roleColor: core_roles.color,
            rolePrefix: core_roles.prefix,
          })
          .from(core_users_secondary_roles)
          .innerJoin(
            core_roles,
            eq(core_roles.id, core_users_secondary_roles.roleId),
          )
          .where(inArray(core_users_secondary_roles.userId, userIds))
      : [];

    // Role names live in `core_languages_words`, so resolve the translations for
    // every role referenced by the listed users (primary and secondary) at once.
    const roleNames = await resolveRoleNames(c, [
      ...data.edges.map(user => user.roleId),
      ...secondaryRoleRows.map(row => row.roleId),
    ]);

    return c.json({
      pageInfo: data.pageInfo,
      edges: data.edges.map(
        ({
          avatarKey,
          deletionScheduledAt,
          deletionStatus,
          roleColor,
          rolePrefix,
          ...user
        }) => ({
          ...user,
          deletion:
            deletionScheduledAt &&
            (deletionStatus === "pending" || deletionStatus === "failed")
              ? { scheduledAt: deletionScheduledAt, status: deletionStatus }
              : null,
          avatarUrl: storageUrlOf(c, avatarKey),
          role: {
            id: user.roleId,
            color: roleColor,
            prefix: rolePrefix,
            name: roleNames.get(user.roleId) ?? [],
          },
          secondaryRoles: secondaryRoleRows
            .filter(row => row.userId === user.id)
            .map(row => ({
              id: row.roleId,
              color: row.roleColor,
              prefix: row.rolePrefix,
              name: roleNames.get(row.roleId) ?? [],
            })),
        }),
      ),
    });
  },
});
