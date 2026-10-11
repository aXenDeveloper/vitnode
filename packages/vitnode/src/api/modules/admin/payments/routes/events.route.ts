import { getColumns, inArray } from "drizzle-orm";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "@/api/lib/with-pagination";
import { CONFIG_PLUGIN } from "@/config";
import { core_payments_webhook_events } from "@/database/payments";

import { commaList } from "../filters";

const EVENT_STATUSES = ["pending", "processed", "failed"] as const;
type EventStatus = (typeof EVENT_STATUSES)[number];
const isStatus = (value: string): value is EventStatus =>
  (EVENT_STATUSES as readonly string[]).includes(value);

export const listWebhookEventsAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "payments", permission: "can_view" },
  route: {
    method: "get",
    description:
      "The webhook inbox: what each provider event was about and whether processing it worked. Raw payloads are never stored.",
    path: "/events",
    request: {
      query: zodPaginationQuery.extend({
        order: z.enum(["asc", "desc"]).optional(),
        orderBy: z.enum(["receivedAt"]).optional(),
        status: z.string().max(100).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              edges: z.array(
                z.object({
                  attempts: z.number(),
                  externalId: z.string(),
                  id: z.number(),
                  lastError: z.string().nullable(),
                  processedAt: z.date().nullable(),
                  provider: z.string(),
                  providerScope: z.string(),
                  receivedAt: z.date(),
                  status: z.enum(EVENT_STATUSES),
                  targetId: z.string(),
                  targetKind: z.string(),
                  type: z.string(),
                }),
              ),
              pageInfo: zodPaginationPageInfo,
            }),
          },
        },
        description: "One page of webhook events",
      },
    },
  },
  handler: async c => {
    const query = c.req.valid("query");
    const statuses = commaList(query.status, isStatus);

    const page = await withPagination({
      c,
      orderBy: {
        column: core_payments_webhook_events.receivedAt,
        order: query.order ?? "desc",
      },
      params: { query },
      primaryCursor: core_payments_webhook_events.id,
      query: async ({ cursorSelection, limit, offset, orderBy, where }) =>
        await c
          .get("db")
          .select({
            ...getColumns(core_payments_webhook_events),
            ...cursorSelection,
          })
          .from(core_payments_webhook_events)
          .where(where)
          .orderBy(orderBy)
          .limit(limit)
          .offset(offset),
      table: core_payments_webhook_events,
      where: statuses.length
        ? inArray(core_payments_webhook_events.status, statuses)
        : undefined,
    });

    return c.json({
      edges: page.edges.map(row => ({
        attempts: row.attempts,
        externalId: row.externalId,
        id: row.id,
        lastError: row.lastError,
        processedAt: row.processedAt,
        provider: row.provider,
        providerScope: row.providerScope,
        receivedAt: row.receivedAt,
        status: row.status,
        targetId: row.target.id ?? "",
        targetKind: row.target.kind ?? "",
        type: row.type,
      })),
      pageInfo: page.pageInfo,
    });
  },
});
