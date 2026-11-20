import { z } from "@hono/zod-openapi";
import { and, desc, eq, lt } from "drizzle-orm";

import { buildRoute } from "@/builders";
import { core_reactions_entries } from "@/database/reactions";
import { loadPublicPeople } from "@/lib/public-people";
import { getReactionCatalog } from "@/lib/reactions/catalog";
import { REACTIONS_LIMITS } from "@/lib/reactions/const";

import { reactionTargetOf } from "../lib/target";
import { json, reactionUserSchema, targetFields } from "../reactions.schema";

export const reactionUsersRoute = buildRoute({
  route: {
    method: "get",
    path: "/users",
    description:
      "Who reacted to one target, newest first, optionally only with one reaction. Empty for a target the visitor cannot read",
    request: {
      query: z.object({
        ...targetFields,
        id: z.string().min(1).max(64),
        reaction: z.string().min(1).max(32).optional(),
        cursor: z.string().regex(/^\d+$/).max(12).optional(),
      }),
    },
    responses: {
      200: json(
        z.object({
          edges: z.array(reactionUserSchema),
          nextCursor: z.string().nullable(),
        }),
        "People who reacted",
      ),
    },
  },
  handler: async c => {
    const query = c.req.valid("query");
    const empty = { edges: [], nextCursor: null };
    const registered = reactionTargetOf(c, query);
    const id = registered?.definition.parseId(query.id) ?? null;
    if (!registered || id === null) {
      return c.json(empty, 200);
    }
    const access = (await registered.definition.access(c, { ids: [id] })).get(
      id,
    );
    if (!access?.canRead) return c.json(empty, 200);

    const catalog = (await getReactionCatalog(c)).filter(item => item.enabled);
    const reaction = query.reaction
      ? catalog.find(item => item.code === query.reaction)
      : undefined;
    if (query.reaction && !reaction) return c.json(empty, 200);

    const rows = await c
      .get("db")
      .select({
        createdAt: core_reactions_entries.createdAt,
        id: core_reactions_entries.id,
        reactionId: core_reactions_entries.reactionId,
        userId: core_reactions_entries.userId,
      })
      .from(core_reactions_entries)
      .where(
        and(
          eq(core_reactions_entries.pluginId, registered.pluginId),
          eq(core_reactions_entries.targetType, registered.definition.type),
          eq(core_reactions_entries.targetId, id),
          ...(reaction
            ? [eq(core_reactions_entries.reactionId, reaction.id)]
            : []),
          ...(query.cursor
            ? [lt(core_reactions_entries.id, Number(query.cursor))]
            : []),
        ),
      )
      .orderBy(desc(core_reactions_entries.id))
      .limit(REACTIONS_LIMITS.usersPerPage + 1);

    const page = rows.slice(0, REACTIONS_LIMITS.usersPerPage);
    const people = await loadPublicPeople(
      c,
      page.map(row => row.userId),
    );
    const codeOf = new Map(catalog.map(item => [item.id, item.code]));

    return c.json(
      {
        edges: page.flatMap(row => {
          const user = people.get(row.userId);
          const code = codeOf.get(row.reactionId);

          return user && code
            ? [{ createdAt: row.createdAt, reaction: code, user }]
            : [];
        }),
        nextCursor:
          rows.length > REACTIONS_LIMITS.usersPerPage
            ? String(page[page.length - 1].id)
            : null,
      },
      200,
    );
  },
});
