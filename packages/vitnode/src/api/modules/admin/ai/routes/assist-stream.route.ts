import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { zodAiRunBody } from "@/api/lib/ai/run.schema";
import {
  AI_NDJSON_HEADERS,
  aiNdjsonStream,
} from "@/api/lib/ai/stream-response";

export const assistStreamAiAdminRoute = buildRoute({
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
