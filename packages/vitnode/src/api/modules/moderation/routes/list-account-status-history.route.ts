import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";

import {
  loadOwnHistoryPage,
  OWN_HISTORY_KINDS,
  OWN_HISTORY_PAGE_SIZE,
  OWN_HISTORY_STATUSES,
  ownHistoryItemSchema,
} from "../lib/own-standing";
import { json } from "../moderation.schema";

const listOf = <T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T[] => {
  const allowedSet = new Set<string>(allowed);

  return (value ?? "")
    .split(",")
    .map(item => item.trim())
    .filter((item): item is T => allowedSet.has(item));
};

export const accountStatusHistoryRoute = buildRoute({
  route: {
    method: "get",
    path: "/account-status/history",
    description:
      "One page of the signed-in member's own warnings and suspensions, newest first by default. Filters by kind and status, sorts by date or points and searches reason titles and messages. A page past the end answers with the last page. Never includes staff notes",
    request: {
      query: z.object({
        page: z.coerce.number().int().positive().max(10_000).default(1),
        pageSize: z.coerce
          .number()
          .int()
          .positive()
          .max(100)
          .default(OWN_HISTORY_PAGE_SIZE),
        search: z.string().trim().max(100).optional(),
        kind: z.string().max(200).optional(),
        status: z.string().max(200).optional(),
        orderBy: z.enum(["issuedAt", "points"]).default("issuedAt"),
        order: z.enum(["asc", "desc"]).default("desc"),
      }),
    },
    responses: {
      200: json(
        z.object({
          items: z.array(ownHistoryItemSchema),
          page: z.number(),
          pageSize: z.number(),
          total: z.number(),
        }),
        "One page of the account's history",
      ),
      401: { description: "Sign in first" },
    },
  },
  handler: async c => {
    const userId = c.get("user")?.id ?? c.get("suspension")?.userId;
    if (!userId) return c.json({ error: "unauthenticated" }, 401);

    const query = c.req.valid("query");
    const { items, page, total } = await loadOwnHistoryPage(
      c,
      userId,
      {
        kinds: listOf(query.kind, OWN_HISTORY_KINDS),
        order: query.order,
        orderBy: query.orderBy,
        page: query.page,
        pageSize: query.pageSize,
        search: query.search,
        statuses: listOf(query.status, OWN_HISTORY_STATUSES),
      },
      new Date(),
    );

    return c.json({ items, page, pageSize: query.pageSize, total }, 200);
  },
});
