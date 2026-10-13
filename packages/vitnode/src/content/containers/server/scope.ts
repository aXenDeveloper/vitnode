import type { Context } from "hono";

import { eq } from "drizzle-orm";

import type { ModerationScopeDefinition } from "../../../api/lib/moderation/scopes";
import type { AnyContentContainerDefinition } from "../types";

import { core_content_containers } from "../../../database/content-containers";
import { contentContainerI18nKeys } from "../../admin/containers";
import { CONTENT_CONTAINER_TREE_SUFFIX } from "../const";
import { contentContainerAncestors, orderContentContainers } from "../tree";

interface ScopeResource {
  context: string[];
  id: string;
  label: string;
}

const resourcesOf = async (
  c: Context,
  definition: AnyContentContainerDefinition,
): Promise<ScopeResource[]> => {
  const rows = await c
    .get("db")
    .select({
      id: core_content_containers.id,
      name: core_content_containers.name,
      parentId: core_content_containers.parentId,
      position: core_content_containers.position,
    })
    .from(core_content_containers)
    .where(eq(core_content_containers.definitionId, definition.id));

  const parents = new Set(rows.map(row => row.parentId));

  return orderContentContainers(rows, definition.ordering.mode).flatMap(row => {
    const context = contentContainerAncestors(rows, row.id)
      .filter(ancestor => ancestor.id !== row.id)
      .map(ancestor => ancestor.name);
    const own = { context, id: String(row.id), label: row.name };

    return parents.has(row.id)
      ? [
          own,
          {
            context,
            id: `${row.id}${CONTENT_CONTAINER_TREE_SUFFIX}`,
            label: `${row.name} › *`,
          },
        ]
      : [own];
  });
};

/**
 * The moderation scope family of a container collection with policies. A
 * resource is one container (`"12"`) or, for a container with children, the
 * container and everything below it (`"12:tree"`).
 */
export const contentContainerModerationScope = (
  definition: AnyContentContainerDefinition,
  pluginId: string,
): ModerationScopeDefinition => ({
  id: definition.id,
  label: contentContainerI18nKeys(definition, pluginId).title,
  find: async (c, ids) => {
    const wanted = new Set(ids);

    return (await resourcesOf(c, definition)).filter(item =>
      wanted.has(item.id),
    );
  },
  list: async (c, { cursor, limit, search }) => {
    const needle = search?.toLowerCase();
    const all = (await resourcesOf(c, definition)).filter(
      item =>
        !needle ||
        item.label.toLowerCase().includes(needle) ||
        item.context.some(name => name.toLowerCase().includes(needle)),
    );
    const start = cursor ? Math.max(Number(cursor) || 0, 0) : 0;
    const items = all.slice(start, start + limit);

    return {
      items,
      nextCursor: start + limit < all.length ? String(start + limit) : null,
    };
  },
});
