import { z } from "@hono/zod-openapi";
import { count, eq, max, sql } from "drizzle-orm";

import { buildRoute } from "@/builders";
import { core_reactions } from "@/database/reactions";
import { reactionCatalogChangedEvent } from "@/events/reactions";
import { multiLangAuditLabel } from "@/lib/audit/labels";
import { writeAuditLog } from "@/lib/audit/write";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { forgetReactionCatalog } from "@/lib/reactions/catalog";
import { REACTIONS_LIMITS } from "@/lib/reactions/const";
import { json } from "@/modules/reactions/reactions.schema";

import { lookOf, replaceReactionRoles, saveReactionTitle } from "../lib/save";
import { errorSchema, reactionBody } from "../reactions.schema";

const LOCK_REACTIONS = sql`lock table ${core_reactions} in share row exclusive mode`;

export const createReactionAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.reactions.canManage,
  route: {
    method: "post",
    path: "/create",
    description:
      "Add a reaction at the end of the list (Admin only). Members can use it right away when their roles allow it",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: reactionBody } },
      },
    },
    responses: {
      201: json(z.object({ id: z.number() }), "Reaction created"),
      400: json(
        errorSchema,
        "The emoji, icon or image does not match `kind` (`invalid_look`)",
      ),
      403: { description: "Access Denied" },
      409: json(
        errorSchema,
        "The code is taken (`code_taken`) or the list is full (`limit_reached`)",
      ),
    },
  },
  handler: async c => {
    const body = c.req.valid("json");
    const look = lookOf(body);
    if ("error" in look) return c.json({ error: look.error }, 400);

    const created = await c.get("db").transaction(async tx => {
      await tx.execute(LOCK_REACTIONS);
      const [taken] = await tx
        .select({ id: core_reactions.id })
        .from(core_reactions)
        .where(eq(core_reactions.code, body.code))
        .limit(1);
      if (taken) return "code_taken" as const;

      const [{ position, total }] = await tx
        .select({ position: max(core_reactions.position), total: count() })
        .from(core_reactions);
      if (total >= REACTIONS_LIMITS.maxReactions) {
        return "limit_reached" as const;
      }

      const [row] = await tx
        .insert(core_reactions)
        .values({
          ...look,
          allRoles: body.allRoles,
          code: body.code,
          enabled: body.enabled,
          kind: body.kind,
          points: body.points,
          position: (position ?? -1) + 1,
        })
        .returning({ id: core_reactions.id });
      await replaceReactionRoles(tx, row.id, body.roles);
      await writeAuditLog(
        c,
        {
          action: "reaction.created",
          metadata: { code: body.code, kind: body.kind, points: body.points },
          target: {
            id: row.id,
            label: multiLangAuditLabel(body.title) ?? body.code,
            type: "reaction",
          },
        },
        tx,
      );

      return row;
    });
    if (typeof created === "string") return c.json({ error: created }, 409);

    await saveReactionTitle(c, created.id, body.title);
    await forgetReactionCatalog(c);
    await c.get("events").emit(reactionCatalogChangedEvent, {
      action: "created",
      reactionId: created.id,
    });

    return c.json({ id: created.id }, 201);
  },
});
