import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import z from "zod";

import { buildRoute } from "@/api/lib/route";
import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "@/api/lib/with-pagination";
import { CONFIG_PLUGIN } from "@/config";
import { core_files } from "@/database/files";
import { parseImageDimensions } from "@/lib/api/upload";

export const listUserFilesRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description: "List files uploaded by the current user.",
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
                  dimensions: z
                    .object({ width: z.number(), height: z.number() })
                    .nullable(),
                  url: z.string().nullable(),
                }),
              ),
              pageInfo: zodPaginationPageInfo,
            }),
          },
        },
        description: "List of the current user's files",
      },
      401: {
        description: "Not signed in",
      },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const query = c.req.valid("query");
    const hasAdapter = !!c.get("core").storage?.adapter;
    const storage = c.get("storage");

    const data = await withPagination({
      params: { query },
      c,
      primaryCursor: core_files.id,
      search: [core_files.name],
      where: eq(core_files.userId, user.id),
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
          })
          .from(core_files)
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

    return c.json({
      ...data,
      edges: data.edges.map(({ key, ...file }) => ({
        ...file,
        url: hasAdapter ? storage.getUrl(key) : null,
        dimensions: parseImageDimensions(file.metadata),
      })),
    });
  },
});
