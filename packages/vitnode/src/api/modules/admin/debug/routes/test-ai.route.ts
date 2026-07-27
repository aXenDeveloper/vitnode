import { streamText } from "ai";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

export const zodTestAiSchema = z.object({
  // A configured model id (see `ai.models`). Omit for the default (first) model.
  model: z.string().optional(),
  prompt: z.string().min(1).max(5000),
});

export const testAiDebugAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "system", permission: "can_test_ai" },
  route: {
    method: "post",
    description:
      "Stream a completion from a configured AI model to verify the setup.",
    path: "/test-ai",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: zodTestAiSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          // NDJSON stream: one JSON object per line - `{"t":"…"}` for a text
          // delta, `{"e":"…"}` when generation fails mid-stream (so the real
          // provider error reaches the client instead of a silent empty stream).
          "application/x-ndjson": {
            schema: z.string(),
          },
        },
        description: "Streamed NDJSON events",
      },
      400: {
        description: "No AI models configured",
      },
    },
  },
  handler: c => {
    // Clear 400 instead of the generic 500 the model resolver throws when no
    // model is configured.
    if (!c.get("core").ai?.models.length) {
      throw new HTTPException(400, {
        message: "No AI models configured",
      });
    }

    const { model, prompt } = c.req.valid("json");

    const result = streamText({
      model: c.get("ai").model(model),
      prompt,
      onError: ({ error }) => {
        void c.get("log").error(`AI test stream failed: ${String(error)}`);
      },
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: { e: string } | { t: string }) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };

        try {
          for await (const part of result.stream) {
            if (part.type === "text-delta") {
              send({ t: part.text });
            } else if (part.type === "error") {
              send({
                e:
                  part.error instanceof Error
                    ? part.error.message
                    : String(part.error),
              });
            }
          }
        } catch (error) {
          send({ e: error instanceof Error ? error.message : String(error) });
        } finally {
          controller.close();
        }
      },
    });

    return c.body(body, 200, {
      "Content-Type": "application/x-ndjson; charset=utf-8",
    });
  },
});
