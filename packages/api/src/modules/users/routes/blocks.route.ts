import { z } from "@hono/zod-openapi";
import { desc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/builders";
import { core_users_blocks } from "@/database/chat";
import { blockUser, ChatError, unblockUser } from "@/lib/chat/service";
import { loadPublicPeople, zodPublicPerson } from "@/lib/public-people";

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});

const errorSchema = z.object({ error: z.string() });
const params = z.object({
  userId: z
    .string()
    .regex(/^[1-9]\d{0,9}$/u)
    .openapi({ example: "2" }),
});
const noStore = { "Cache-Control": "private, no-store" };

export const listBlocksRoute = buildRoute({
  route: {
    method: "get",
    path: "/blocks",
    description:
      "Members the signed-in member blocked, newest first. Blocked members can't send them chat requests or add them to group chats",
    responses: {
      200: json(
        z.object({
          items: z.array(
            z.object({ blockedAt: z.string(), user: zodPublicPerson }),
          ),
        }),
        "Blocked members",
      ),
      401: { description: "Sign in first" },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "Unauthorized" });
    const rows = await c
      .get("db")
      .select({
        blockedUserId: core_users_blocks.blockedUserId,
        createdAt: core_users_blocks.createdAt,
      })
      .from(core_users_blocks)
      .where(eq(core_users_blocks.userId, user.id))
      .orderBy(desc(core_users_blocks.createdAt));
    const people = await loadPublicPeople(
      c,
      rows.map(row => row.blockedUserId),
    );

    return c.json(
      {
        items: rows.flatMap(row => {
          const person = people.get(row.blockedUserId);

          return person
            ? [{ blockedAt: row.createdAt.toISOString(), user: person }]
            : [];
        }),
      },
      200,
      noStore,
    );
  },
});

const blockResponses = {
  200: json(z.object({ ok: z.boolean() }), "Saved"),
  400: json(errorSchema, "Yourself, or the block list is full"),
  401: { description: "Sign in first" },
  404: json(errorSchema, "No such member"),
};

const runBlock = async (
  c: Parameters<typeof blockUser>[0],
  userId: number,
  block: boolean,
): Promise<ChatError | null> => {
  try {
    if (block) {
      await blockUser(c, userId);
    } else {
      await unblockUser(c, userId);
    }

    return null;
  } catch (error) {
    if (error instanceof ChatError) return error;
    throw error;
  }
};

export const blockUserRoute = buildRoute({
  route: {
    method: "put",
    path: "/blocks/{userId}",
    description: "Block a member",
    request: { params },
    responses: blockResponses,
  },
  handler: async c => {
    if (!c.get("user"))
      throw new HTTPException(401, { message: "Unauthorized" });
    const error = await runBlock(c, Number(c.req.valid("param").userId), true);
    if (error) {
      return error.status === 400
        ? c.json({ error: error.code }, 400)
        : c.json({ error: error.code }, 404);
    }

    return c.json({ ok: true }, 200, noStore);
  },
});

export const unblockUserRoute = buildRoute({
  route: {
    method: "delete",
    path: "/blocks/{userId}",
    description: "Unblock a member",
    request: { params },
    responses: blockResponses,
  },
  handler: async c => {
    if (!c.get("user"))
      throw new HTTPException(401, { message: "Unauthorized" });
    const error = await runBlock(c, Number(c.req.valid("param").userId), false);
    if (error) {
      return error.status === 400
        ? c.json({ error: error.code }, 400)
        : c.json({ error: error.code }, 404);
    }

    return c.json({ ok: true }, 200, noStore);
  },
});
