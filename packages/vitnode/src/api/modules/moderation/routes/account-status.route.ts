import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { findActiveSuspension } from "@/api/lib/moderation/warnings/suspension";

import {
  loadOwnHistoryPage,
  OWN_HISTORY_KINDS,
  OWN_HISTORY_PAGE_SIZE,
  OWN_HISTORY_STATUSES,
  ownHistoryItemSchema,
  ownSanctionSchema,
  ownWarningSchema,
  serializeOwnSanction,
  serializeOwnWarnings,
} from "../lib/own-standing";
import { json } from "../lib/schema";
import { loadActivePoints } from "../lib/warnings-service";
import { loadUserSanctions, loadUserWarnings } from "../lib/warnings-view";

export const accountStatusRoute = buildRoute({
  route: {
    method: "get",
    path: "/account-status",
    description:
      "The signed-in member's own standing: active warning points, warning history and suspensions. Also answers for a suspended account, whose session is otherwise treated as a guest. Never includes staff notes",
    responses: {
      200: json(
        z.object({
          suspension: z.object({ endsAt: z.date().nullable() }).nullable(),
          activePoints: z.number(),
          warnings: z.array(ownWarningSchema),
          sanctions: z.array(ownSanctionSchema),
        }),
        "The account's standing",
      ),
      401: { description: "Sign in first" },
    },
  },
  handler: async c => {
    const userId = c.get("user")?.id ?? c.get("suspension")?.userId;
    if (!userId) return c.json({ error: "unauthenticated" }, 401);

    const now = new Date();
    const [warnings, sanctions, activePoints, suspension] = await Promise.all([
      loadUserWarnings(c, userId),
      loadUserSanctions(c, userId),
      loadActivePoints(c.get("db"), userId, now),
      findActiveSuspension(c, userId, now),
    ]);

    return c.json(
      {
        suspension: suspension ? { endsAt: suspension.endsAt } : null,
        activePoints,
        warnings: await serializeOwnWarnings(c, warnings, now),
        sanctions: sanctions.map(row => serializeOwnSanction(row, now)),
      },
      200,
    );
  },
});

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
