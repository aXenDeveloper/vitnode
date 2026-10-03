import { buildRoute } from "@vitnode/core/api/lib/route";
import { z } from "zod";

import {
  TRANSLATE_FIELD_AI_ACTION,
  zodTranslateAiSchema,
} from "@/api/ai/actions";
import { CONFIG_PLUGIN } from "@/const";

export const translateAiAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "posts", permission: "can_edit" },
  route: {
    method: "post",
    description:
      "Translate one field of an article into another language with the configured AI model.",
    path: "/translate",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: zodTranslateAiSchema } },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ text: z.string() }) },
        },
        description: "The translated text",
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
      action: TRANSLATE_FIELD_AI_ACTION,
      input: c.req.valid("json"),
    });

    return c.json({ text: output }, 200);
  },
});
