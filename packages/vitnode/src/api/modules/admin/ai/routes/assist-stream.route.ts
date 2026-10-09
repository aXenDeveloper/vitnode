import { z } from "zod";

import { zodAiRunBody } from "@/api/lib/ai/run-schemas";
import {
  AI_NDJSON_HEADERS,
  aiNdjsonStream,
} from "@/api/lib/ai/stream-response";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

export const assistStreamAiAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description: "Stream a registered AI text action for the signed-in admin.",
    path: "/assist/stream",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: zodAiRunBody } },
      },
    },
    responses: {
      200: {
        content: { "application/x-ndjson": { schema: z.string() } },
        description: "Text deltas, then the run summary",
      },
    },
  },
  handler: async c => {
    const body = c.req.valid("json");

    const stream = await aiNdjsonStream(c, {
      ...body,
      resource: body.resource ?? undefined,
    });

    return new Response(stream, {
      headers: AI_NDJSON_HEADERS,
      status: 200,
    }) as never;
  },
});

export const estimateAiAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description:
      "The most a run could cost you, before running it. An upper bound, not a price.",
    path: "/assist/estimate",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: zodAiRunBody } },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              maxPoints: z.string().nullable(),
              maxUsd: z.string().nullable(),
            }),
          },
        },
        description: "Upper bound",
      },
    },
  },
  handler: async c => {
    const body = c.req.valid("json");
    const estimate = await c.get("ai").estimate({
      ...body,
      resource: body.resource ?? undefined,
    });

    return c.json(estimate, 200);
  },
});
