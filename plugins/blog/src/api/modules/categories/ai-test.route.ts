import { z } from "@hono/zod-openapi";
import { buildRoute } from "@vitnode/core/api/lib/route";
import { generateText } from "ai";

import { CONFIG_PLUGIN } from "@/const";

/**
 * Example: generate text with a configured AI model.
 *
 * Call the native AI SDK `generateText` and resolve the model with
 * `c.get("ai").model(id?)` (omit the id for the default/first model). Requires
 * an `ai.models` entry in `buildApiConfig` (see the AI docs).
 */
export const aiTestRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description: "Example route: generate text with the configured AI model.",
    path: "/ai-test",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              // A configured model id (e.g. "default", "fast"). Omit to use the
              // default (first) model.
              model: z.string().optional(),
              prompt: z.string().min(1),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              text: z.string(),
            }),
          },
        },
        description: "The generated text.",
      },
    },
  },
  handler: async c => {
    const { model, prompt } = c.req.valid("json");

    const { text } = await generateText({
      model: c.get("ai").model(model),
      prompt,
    });

    return c.json({ text });
  },
});
