import { eq } from "drizzle-orm";
import z from "zod";

import { resolveRoleNames } from "@/api/lib/resolve-role-names";
import { buildRoute } from "@/api/lib/route";
import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "@/api/lib/with-pagination";
import { CONFIG_PLUGIN } from "@/config";
import { core_files } from "@/database/files";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import { parseImageDimensions } from "@/lib/api/upload";

export const listFilesAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "files", permission: "can_view" },
  route: {
    method: "get",
    description: "List uploaded files stored in core_files (Admin only).",
    path: "/",
    request: {
      query: zodPaginationQuery.extend({
        order: z.enum(["asc", "desc"]).optional(),
        orderBy: z.enum(["name", "size", "createdAt"]).optional(),
        search: z.string().optional(),
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
                  folder: z.string(),
                  mimeType: z.string().nullable(),
                  size: z.number(),
                  metadata: z.record(z.string(), z.unknown()),
                  createdAt: z.date(),
                  // Pixel dimensions for images, or `null` for non-images and
                  // files uploaded without image processing.
                  dimensions: z
                    .object({ width: z.number(), height: z.number() })
                    .nullable(),
                  // The uploader, or `null` when uploaded anonymously or the
                  // user has since been removed. `role.name` carries every
                  // translation; the frontend resolves the active locale.
                  user: z
                    .object({
                      id: z.number(),
                      name: z.string(),
                      nameCode: z.string(),
                      role: z.object({
                        id: z.number(),
                        color: z.string().nullable(),
                        name: z.array(
                          z.object({
                            name: z.string(),
                            languageCode: z.string(),
                          }),
                        ),
                      }),
                    })
                    .nullable(),
                  // Public URL for the stored object, or `null` when no storage
                  // adapter is currently configured.
                  url: z.string().nullable(),
                }),
              ),
              pageInfo: zodPaginationPageInfo,
            }),
          },
        },
        description: "List of uploaded files",
      },
    },
  },
  handler: async c => {
    const query = c.req.valid("query");
    const hasAdapter = !!c.get("core").storage?.adapter;
    const storage = c.get("storage");

    const data = await withPagination({
      params: { query },
      c,
      primaryCursor: core_files.id,
      search: [core_files.name],
      query: async ({ limit, where, orderBy }) =>
        await c
          .get("db")
          .select({
            id: core_files.id,
            name: core_files.name,
            key: core_files.key,
            folder: core_files.folder,
            mimeType: core_files.mimeType,
            size: core_files.size,
            metadata: core_files.metadata,
            createdAt: core_files.createdAt,
            userId: core_files.userId,
            userName: core_users.name,
            userNameCode: core_users.nameCode,
            userRoleId: core_users.roleId,
            userRoleColor: core_roles.color,
          })
          .from(core_files)
          .leftJoin(core_users, eq(core_users.id, core_files.userId))
          .leftJoin(core_roles, eq(core_roles.id, core_users.roleId))
          .where(where)
          .orderBy(orderBy)
          .limit(limit),
      table: core_files,
      orderBy: {
        column: query.orderBy
          ? core_files[query.orderBy]
          : core_files.createdAt,
        order: query.order ?? "desc",
      },
    });

    const roleNames = await resolveRoleNames(
      c,
      data.edges
        .map(edge => edge.userRoleId)
        .filter((id): id is number => id != null),
    );

    return c.json({
      ...data,
      edges: data.edges.map(
        ({
          key,
          userId,
          userName,
          userNameCode,
          userRoleId,
          userRoleColor,
          ...file
        }) => ({
          ...file,
          url: hasAdapter ? storage.getUrl(key) : null,
          dimensions: parseImageDimensions(file.metadata),
          user:
            userId != null && userName != null
              ? {
                  id: userId,
                  name: userName,
                  nameCode: userNameCode ?? "",
                  role: {
                    id: userRoleId ?? 0,
                    color: userRoleColor ?? null,
                    name:
                      userRoleId != null
                        ? (roleNames.get(userRoleId) ?? [])
                        : [],
                  },
                }
              : null,
        }),
      ),
    });
  },
});
