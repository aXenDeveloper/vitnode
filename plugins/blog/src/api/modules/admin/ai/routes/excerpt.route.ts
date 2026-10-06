import { buildRoute } from "@vitnode/core/api/lib/route";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { writeExcerptWithAi } from "@/api/lib/ai-writing";
import { CONFIG_PLUGIN } from "@/const";

export const zodExcerptAiSchema = z.object({
  content: z.string().trim().min(1).max(200_000),
  locale: z.string().min(2).max(16),
  title: z.string().trim().min(1).max(255),
});

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
      400: { description: "No AI model is configured" },
    },
  },
  handler: async c => {
    if (!c.get("core").ai?.models.length) {
      throw new HTTPException(400, { message: "No AI models configured" });
    }

    const { content, locale, title } = c.req.valid("json");
    const excerpt = await writeExcerptWithAi({
      content,
      locale,
      model: c.get("ai").model(),
      title,
    });

    return c.json({ text: excerpt }, 200);
  },
});
