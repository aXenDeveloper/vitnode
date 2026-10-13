import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type {
  AnyContentContainerDefinition,
  ContentContainerPublicRecord,
} from "../types";

import { setPageCacheTags } from "../../../api/lib/page-cache";
import { buildRoute } from "../../../api/lib/route";
import { contentContainerTag } from "../../cache";
import { CONTENT_CONTAINER_SLUG_MAX_LENGTH } from "../const";
import { createContentContainerService } from "./service";

const NUMERIC_ID = /^[1-9][0-9]{0,15}$/;

/**
 * The public, read-only routes of one container collection, mounted under
 * `/api/{pluginId}/content/{publicApi.path}`. Only `publicApi.fields` of each
 * container's metadata crosses.
 */
export const buildContentContainerPublicRoutes = <
  TDefinition extends AnyContentContainerDefinition,
  P extends string,
>(
  definition: TDefinition,
  { pluginId }: { pluginId: P },
) => {
  const record = definition.schemas.publicRecord as unknown as z.ZodType<
    ContentContainerPublicRecord<TDefinition>
  >;
  const service = (c: Parameters<typeof createContentContainerService>[0]) =>
    createContentContainerService(c, { definition, pluginId });

  const list = buildRoute({
    pluginId,
    route: {
      method: "get",
      path: "/",
      description: `List the containers of ${definition.id}, in tree order. \`parent=root\` or \`parent={id}\` narrows the list to one level.`,
      request: {
        query: z.object({
          parent: z
            .union([z.literal("root"), z.coerce.number().int().positive()])
            .optional(),
        }),
      },
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({ items: z.array(record) }),
            },
          },
          description:
            "Containers, each parent followed by its subtree - nest them with `contentContainerTree`",
        },
        404: { description: "The parent does not exist" },
      },
    },
    handler: async c => {
      const { parent } = c.req.valid("query");
      const containers = service(c);
      const all = await containers.list();
      let items = all;

      if (parent === "root") {
        items = all.filter(item => item.parentId === null);
      } else if (parent !== undefined) {
        if (!all.some(item => item.id === parent)) {
          throw new HTTPException(404, { message: "Container not found." });
        }
        items = all.filter(item => item.parentId === parent);
      }

      setPageCacheTags(c, [contentContainerTag(definition.id)]);

      return c.json({ items: items.map(containers.toPublic) }, 200);
    },
  });

  const detail = buildRoute({
    pluginId,
    route: {
      method: "get",
      path: "/{idOrSlug}",
      description: `One container of ${definition.id} by id or slug, with its ancestors (root first) and its direct children`,
      request: {
        params: z.object({
          idOrSlug: z.string().min(1).max(CONTENT_CONTAINER_SLUG_MAX_LENGTH),
        }),
      },
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({
                ancestors: z.array(record),
                children: z.array(record),
                container: record,
              }),
            },
          },
          description: "The container, its breadcrumb and its children",
        },
        404: { description: "Container not found" },
      },
    },
    handler: async c => {
      const { idOrSlug } = c.req.valid("param");
      const containers = service(c);
      const all = await containers.list();
      // A numeric segment is an id; anything else is a slug. A slug made only
      // of digits is still reachable - by its id, which never changes.
      const container = NUMERIC_ID.test(idOrSlug)
        ? all.find(item => item.id === Number(idOrSlug))
        : all.find(item => item.slug === idOrSlug);
      if (!container) {
        throw new HTTPException(404, { message: "Container not found." });
      }

      const byId = new Map(all.map(item => [item.id, item]));
      const ancestors: typeof all = [];
      for (
        let parentId = container.parentId;
        parentId !== null && ancestors.length < all.length;
      ) {
        const parent = byId.get(parentId);
        if (!parent) break;
        ancestors.unshift(parent);
        parentId = parent.parentId;
      }

      setPageCacheTags(c, [contentContainerTag(definition.id)]);

      return c.json(
        {
          ancestors: ancestors.map(containers.toPublic),
          children: all
            .filter(item => item.parentId === container.id)
            .map(containers.toPublic),
          container: containers.toPublic(container),
        },
        200,
      );
    },
  });

  return [list, detail];
};
