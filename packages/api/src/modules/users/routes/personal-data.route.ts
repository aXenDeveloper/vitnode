import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/builders";

export const personalDataExportRoute = buildRoute({
  route: {
    method: "get",
    description:
      "Everything the site stores about the signed-in member, from core and every plugin's `personalData.export` (GDPR Art. 15 and 20), as JSON keyed by plugin id.",
    path: "/me/personal-data",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              exportedAt: z.date(),
              plugins: z.record(z.string(), z.record(z.string(), z.unknown())),
              userId: z.number().int(),
            }),
          },
        },
        description: "The member's data",
      },
      401: { description: "Unauthorized" },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "Unauthorized" });

    const plugins: Record<string, Record<string, unknown>> = {};
    for (const entry of c.get("core").personalData) {
      if (!entry.export) continue;
      plugins[entry.pluginId] = await entry.export({ c, userId: user.id });
    }

    c.header("Cache-Control", "no-store");

    return c.json({ exportedAt: new Date(), plugins, userId: user.id }, 200);
  },
});
