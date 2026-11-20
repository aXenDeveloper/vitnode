import type { Context } from "hono";

import { and, desc, eq, lt } from "drizzle-orm";

import { core_reactions_entries } from "@/database/reactions";
import { core_users } from "@/database/users";

import type { ReactionCatalogEntry } from "./catalog";
import type { ReactionTargetPreview } from "./targets";

import { getReactionCatalog } from "./catalog";
import { findReactionTarget } from "./targets";

/** One reaction a member gave, as their timeline shows it. */
export interface ReactionTimelineItem {
  createdAt: Date;
  /** The entry id; the timeline's cursor. */
  entryId: number;
  reaction: Pick<
    ReactionCatalogEntry,
    "code" | "icon" | "image" | "kind" | "title"
  >;
  target: ReactionTargetPreview & {
    id: string;
    pluginId: string;
    type: string;
  };
}

/** Whether the visitor may see `userId`'s reactions on their profile. */
export const canSeeReactionsOf = async (
  c: Context,
  userId: number,
): Promise<boolean> => {
  if (c.get("user")?.id === userId) return true;
  const [row] = await c
    .get("db")
    .select({ show: core_users.showReactionsOnProfile })
    .from(core_users)
    .where(eq(core_users.id, userId))
    .limit(1);

  return row?.show ?? false;
};

/**
 * Up to `first` reactions `userId` gave before entry `before`, newest first,
 * that the visitor can see: the reaction is enabled, the target type is still
 * registered, `access` lets the visitor read the target and `preview`
 * describes it. Reads in rounds until the page is full or nothing is left, so
 * a page never comes back short because some targets are private.
 */
export const readReactionTimeline = async (
  c: Context,
  {
    before,
    first,
    userId,
  }: { before: null | number; first: number; userId: number },
): Promise<{ done: boolean; items: ReactionTimelineItem[] }> => {
  const catalog = await getReactionCatalog(c);
  const enabled = new Map(
    catalog
      .filter(reaction => reaction.enabled)
      .map(reaction => [reaction.id, reaction]),
  );
  const registry = c.get("core")?.reactions;
  const items: ReactionTimelineItem[] = [];
  let cursor = before;
  const batch = Math.max(first * 2, 20);

  for (let round = 0; round < 4 && items.length < first; round++) {
    const rows = await c
      .get("db")
      .select({
        createdAt: core_reactions_entries.createdAt,
        id: core_reactions_entries.id,
        pluginId: core_reactions_entries.pluginId,
        reactionId: core_reactions_entries.reactionId,
        targetId: core_reactions_entries.targetId,
        targetType: core_reactions_entries.targetType,
      })
      .from(core_reactions_entries)
      .where(
        and(
          eq(core_reactions_entries.userId, userId),
          ...(cursor === null ? [] : [lt(core_reactions_entries.id, cursor)]),
        ),
      )
      .orderBy(desc(core_reactions_entries.id))
      .limit(batch);
    if (rows.length === 0) return { done: true, items };

    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      if (!enabled.has(row.reactionId)) continue;
      const key = `${row.pluginId}\u0000${row.targetType}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }

    const previews = new Map<string, ReactionTargetPreview>();
    await Promise.all(
      [...groups.values()].map(async group => {
        const [{ pluginId, targetType }] = group;
        const registered = findReactionTarget(registry, {
          pluginId,
          type: targetType,
        });
        if (!registered?.definition.preview) return;
        const ids = [...new Set(group.map(row => row.targetId))];
        const access = await registered.definition.access(c, { ids });
        const readable = ids.filter(id => access.get(id)?.canRead);
        if (readable.length === 0) return;
        const found = await registered.definition.preview(c, {
          ids: readable,
        });
        for (const [id, preview] of found) {
          previews.set(`${pluginId}\u0000${targetType}\u0000${id}`, preview);
        }
      }),
    );

    for (const row of rows) {
      cursor = row.id;
      const reaction = enabled.get(row.reactionId);
      const preview = previews.get(
        `${row.pluginId}\u0000${row.targetType}\u0000${row.targetId}`,
      );
      if (!reaction || !preview) continue;

      items.push({
        createdAt: row.createdAt,
        entryId: row.id,
        reaction: {
          code: reaction.code,
          icon: reaction.icon,
          image: reaction.image,
          kind: reaction.kind,
          title: reaction.title,
        },
        target: {
          ...preview,
          id: row.targetId,
          pluginId: row.pluginId,
          type: row.targetType,
        },
      });
      if (items.length >= first) break;
    }
    if (rows.length < batch && items.length < first) {
      return { done: true, items };
    }
  }

  return { done: false, items };
};
