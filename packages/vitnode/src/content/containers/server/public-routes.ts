import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type {
  AnyContentContainerDefinition,
  ContentContainerPublicRecord,
} from "../types";

import type { ContentAccessFlags } from "../../access/policy";

import { setPageCacheTags } from "../../../api/lib/page-cache";
import { buildRoute } from "../../../api/lib/route";
import {
  CONTENT_ACCESS_OPEN_FLAGS,
  zodContentAccessFlags,
} from "../../access/policy";
import { contentAccessFlagsForScopes } from "../../access/server/decide";
import {
  findContentAccessFamily,
  isContentAccessFamilyOpen,
} from "../../access/server/families";
import { CONTENT_ACCESS_PRIVATE_HEADERS } from "../../access/server/http";
import { contentAccessTag, contentContainerTag } from "../../cache";
import { CONTENT_CONTAINER_SLUG_MAX_LENGTH } from "../const";
import { contentContainerAncestors } from "../tree";
import { createContentContainerService } from "./service";

const NUMERIC_ID = /^[1-9][0-9]{0,15}$/;

/**
 * The public routes of one content container type, mounted by
 * `buildContentPublicModule`; plugins do not call this directly.
 */
export const buildContentContainerPublicRoutes = <
  TDefinition extends AnyContentContainerDefinition,
  P extends string,
>(
  definition: TDefinition,
  { pluginId }: { pluginId: P },
) => {
  // Every container says what the viewer may do in it - the frontend shows
  // "sign in to read" from this, the server still decides. Without access
  // rules every flag is `true`.
  const record = definition.schemas.publicRecord.extend({
    access: zodContentAccessFlags,
  }) as unknown as z.ZodType<
    ContentContainerPublicRecord<TDefinition> & {
      access: ContentAccessFlags;
    }
  >;
  const service = (c: Parameters<typeof createContentContainerService>[0]) =>
    createContentContainerService(c, { definition, pluginId });

  type Context = Parameters<typeof createContentContainerService>[0];
  type Item = Awaited<ReturnType<ReturnType<typeof service>["list"]>>[number];

  /**
   * Every container the viewer may see, each with its flags; a container
   * inside a hidden one is hidden too. `shareable` when no rule of the
   * collection keeps anybody out, so the answer is everybody's.
   */
  const visibleContainers = async (
    c: Context,
    all: Item[],
  ): Promise<{
    flags: Map<number, ContentAccessFlags>;
    items: Item[];
    shareable: boolean;
  }> => {
    const family = definition.access.enabled
      ? findContentAccessFamily(c, definition.id)
      : undefined;
    if (!family) {
      return {
        flags: new Map(all.map(item => [item.id, CONTENT_ACCESS_OPEN_FLAGS])),
        items: all,
        shareable: true,
      };
    }

    const flags = new Map<number, ContentAccessFlags>();
    for (const item of all) {
      const { denied: _denied, ...decided } = await contentAccessFlagsForScopes(
        c,
        { scopes: [{ family: family.id, scopeId: String(item.id) }] },
      );
      flags.set(item.id, decided);
    }

    return {
      flags,
      items: all.filter(item => flags.get(item.id)?.canView === true),
      shareable: await isContentAccessFamilyOpen(c, family),
    };
  };

  const withAccess =
    (
      containers: ReturnType<typeof service>,
      flags: Map<number, ContentAccessFlags>,
    ) =>
    (item: Item) => ({
      ...containers.toPublic(item),
      access: flags.get(item.id) ?? CONTENT_ACCESS_OPEN_FLAGS,
    });

  const respond = <T>(
    c: Context,
    body: T,
    shareable: boolean,
  ) => {
    if (!shareable) return c.json(body, 200, CONTENT_ACCESS_PRIVATE_HEADERS);

    setPageCacheTags(c, [
      contentContainerTag(definition.id),
      ...(definition.access.enabled ? [contentAccessTag(definition.id)] : []),
    ]);

    return c.json(body, 200);
  };

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
      const { flags, items: all, shareable } = await visibleContainers(
        c,
        await containers.list(),
      );
      let items = all;

      if (parent === "root") {
        items = all.filter(item => item.parentId === null);
      } else if (parent !== undefined) {
        if (!all.some(item => item.id === parent)) {
          throw new HTTPException(404, { message: "Container not found." });
        }
        items = all.filter(item => item.parentId === parent);
      }

      return respond(
        c,
        { items: items.map(withAccess(containers, flags)) },
        shareable,
      );
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
      const { flags, items: all, shareable } = await visibleContainers(
        c,
        await containers.list(),
      );
      // A container the viewer may not see is not found, like one that never
      // existed - its slug and id answer the same.
      const container = NUMERIC_ID.test(idOrSlug)
        ? all.find(item => item.id === Number(idOrSlug))
        : all.find(item => item.slug === idOrSlug);
      if (!container) {
        throw new HTTPException(404, { message: "Container not found." });
      }

      const ancestors = contentContainerAncestors(all, container.id);
      const toPublic = withAccess(containers, flags);

      return respond(
        c,
        {
          ancestors: ancestors.map(toPublic),
          children: all
            .filter(item => item.parentId === container.id)
            .map(toPublic),
          container: toPublic(container),
        },
        shareable,
      );
    },
  });

  return [list, detail];
};
