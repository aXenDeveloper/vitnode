import { buildRoute } from "@vitnode/core/api/lib/route";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { translateWithAi } from "@/api/lib/ai-writing";
import { CONFIG_PLUGIN } from "@/const";

const zodLocale = z.string().min(2).max(16);

export const zodTranslateAiSchema = z.object({
  format: z.enum(["html", "text"]),
  from: zodLocale,
  text: z.string().trim().min(1).max(100_000),
  to: zodLocale,
});

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
      400: { description: "No AI model is configured" },
    },
  },
  handler: async c => {
    if (!c.get("core").ai?.models.length) {
      throw new HTTPException(400, { message: "No AI models configured" });
    }

    const { format, from, text, to } = c.req.valid("json");
    const translated = await translateWithAi({
      format,
      from,
      model: c.get("ai").model(),
      text,
      to,
    });

    return c.json({ text: translated }, 200);
  },
});
