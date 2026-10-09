import { buildRoute } from "@vitnode/core/api/lib/route";
import { z } from "zod";

import { EXCERPT_AI_ACTION, zodExcerptAiSchema } from "@/api/ai/actions";
import { CONFIG_PLUGIN } from "@/const";

export const excerptAiAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "posts", permission: "can_edit" },
  route: {
    method: "post",
    description:
      "Write a short excerpt for an article with the configured AI model.",
    path: "/excerpt",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: zodExcerptAiSchema } },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ text: z.string() }) },
        },
        description: "The written excerpt",
      },
      400: { description: "No AI model is configured or the input is invalid" },
      403: { description: "No access to posts or to this AI feature" },
      429: { description: "A personal AI limit was reached" },
      502: { description: "The AI provider failed or answered unusably" },
      503: { description: "AI is switched off or the site budget is used up" },
    },
  },
  handler: async c => {
    const { output } = await c.get("ai").run({
      action: EXCERPT_AI_ACTION,
      input: c.req.valid("json"),
    });

    return c.json({ text: output }, 200);
  },
});
