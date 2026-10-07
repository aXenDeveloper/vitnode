import { z } from "@hono/zod-openapi";
import { and, count, eq, ilike, inArray, ne } from "drizzle-orm";

import { buildRoute } from "@/api/lib/route";
import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "@/api/lib/with-pagination";
import { CONFIG_PLUGIN } from "@/config";
import { core_admin_permissions } from "@/database/admins";
import { core_languages_words } from "@/database/languages";
import { core_moderators_permissions } from "@/database/moderators";
import { core_roles } from "@/database/roles";
import { core_users, core_users_secondary_roles } from "@/database/users";
import { containsLikePattern } from "@/lib/api/like-pattern";

import { assertCanListRoles } from "../lib/assert-can-list-roles";
import { withRolesAdminListFields } from "./list-mapping";

const rolesAdminListSchema = z.object({
  edges: z.array(
    z.object({
      id: z.number(),
      // Every translation of the role name - resolved to the active locale on
      // the frontend (see the `RoleFormat` component).
      name: z.array(
        z.object({
          name: z.string(),
          languageCode: z.string(),
        }),
      ),
      color: z.string().nullable(),
      prefix: z.string().nullable(),
      protected: z.boolean(),
      default: z.boolean(),
      root: z.boolean(),
      guest: z.boolean(),
      allowUploadFiles: z.boolean(),
      totalMaxStorage: z.number().nullable(),
      maxStorageForSubmit: z.number().nullable(),
      allowUploadAvatar: z.boolean(),
      allowEditPersonalInfo: z.boolean(),
      maxAvatarSize: z.number(),
      allowUploadCover: z.boolean(),
      maxCoverSize: z.number(),
      createdAt: z.date(),
      updatedAt: z.date(),
      usersCount: z.number(),
      grantsAdmin: z.boolean(),
    }),
  ),
  pageInfo: zodPaginationPageInfo,
});

export const listRolesAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description: "Get list of all roles (Admin only)",
    path: "/list",
    request: {
      query: zodPaginationQuery.extend({
        order: z.enum(["asc", "desc"]).optional(),
        orderBy: z.enum(["id", "createdAt", "updatedAt"]).optional(),
        search: z.string().optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: rolesAdminListSchema,
          },
        },
        description: "List of roles",
      },
      403: {
        description: "Access Denied",
      },
    },
  },
  handler: async c => {
    await assertCanListRoles(c);

    const query = c.req.valid("query");
    const search = query.search?.trim();

    const data = await withPagination({
      params: {
        query,
      },
      // Role names live in `core_languages_words`, so search resolves matching
      // role ids from there instead of a column on `core_roles`.
      where: search
        ? inArray(
            core_roles.id,
            c
              .get("db")
              .select({ id: core_languages_words.itemId })
              .from(core_languages_words)
              .where(
                and(
                  eq(core_languages_words.tableName, "core_roles"),
                  eq(core_languages_words.variable, "name"),
                  eq(core_languages_words.pluginCode, "core"),
                  ilike(
                    core_languages_words.value,
                    containsLikePattern(search),
                  ),
                ),
              ),
          )
        : undefined,
      primaryCursor: core_roles.id,
      query: async ({ cursorSelection, limit, offset, where, orderBy }) =>
        await c
          .get("db")
          .select({
            ...cursorSelection,
            id: core_roles.id,
            color: core_roles.color,
            prefix: core_roles.prefix,
            protected: core_roles.protected,
            default: core_roles.default,
            root: core_roles.root,
            guest: core_roles.guest,
            allowUploadFiles: core_roles.allowUploadFiles,
            totalMaxStorage: core_roles.totalMaxStorage,
            maxStorageForSubmit: core_roles.maxStorageForSubmit,
            allowUploadAvatar: core_roles.allowUploadAvatar,
            allowEditPersonalInfo: core_roles.allowEditPersonalInfo,
            maxAvatarSize: core_roles.maxAvatarSize,
            allowUploadCover: core_roles.allowUploadCover,
            maxCoverSize: core_roles.maxCoverSize,
            createdAt: core_roles.createdAt,
            updatedAt: core_roles.updatedAt,
          })
          .from(core_roles)
          .where(where)
          .orderBy(orderBy)
          .limit(limit)
          .offset(offset),
      table: core_roles,
      orderBy: {
        column: query.orderBy
          ? core_roles[query.orderBy]
          : core_roles.updatedAt,
        order: query.order ?? "desc",
      },
      c,
    });

    const roleIds = data.edges.map(role => role.id);
    const names = roleIds.length
      ? await c
          .get("db")
          .select({
            itemId: core_languages_words.itemId,
            languageCode: core_languages_words.languageCode,
            value: core_languages_words.value,
          })
          .from(core_languages_words)
          .where(
            and(
              eq(core_languages_words.tableName, "core_roles"),
              eq(core_languages_words.variable, "name"),
              eq(core_languages_words.pluginCode, "core"),
              inArray(core_languages_words.itemId, roleIds),
            ),
          )
      : [];
    const primaryCounts = roleIds.length
      ? await c
          .get("db")
          .select({
            roleId: core_users.roleId,
            total: count(),
          })
          .from(core_users)
          .where(inArray(core_users.roleId, roleIds))
          .groupBy(core_users.roleId)
      : [];
    const secondaryCounts = roleIds.length
      ? await c
          .get("db")
          .select({
            roleId: core_users_secondary_roles.roleId,
            total: count(),
          })
          .from(core_users_secondary_roles)
          .innerJoin(
            core_users,
            eq(core_users.id, core_users_secondary_roles.userId),
          )
          .where(
            and(
              inArray(core_users_secondary_roles.roleId, roleIds),
              ne(core_users.roleId, core_users_secondary_roles.roleId),
            ),
          )
          .groupBy(core_users_secondary_roles.roleId)
      : [];
    const [adminEntryRoles, moderatorEntryRoles] = roleIds.length
      ? await Promise.all([
          c
            .get("db")
            .selectDistinct({ roleId: core_admin_permissions.roleId })
            .from(core_admin_permissions)
            .where(inArray(core_admin_permissions.roleId, roleIds)),
          c
            .get("db")
            .selectDistinct({ roleId: core_moderators_permissions.roleId })
            .from(core_moderators_permissions)
            .where(inArray(core_moderators_permissions.roleId, roleIds)),
        ])
      : [[], []];
    const adminRoleIds = new Set<null | number>([
      ...data.edges.filter(role => role.root).map(role => role.id),
      ...adminEntryRoles.map(row => row.roleId),
      ...moderatorEntryRoles.map(row => row.roleId),
    ]);

    return c.json({
      pageInfo: data.pageInfo,
      edges: withRolesAdminListFields({
        adminRoleIds,
        names,
        roles: data.edges,
        userCounts: [...primaryCounts, ...secondaryCounts],
      }),
    });
  },
});
