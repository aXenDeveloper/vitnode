import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { cronAuthMiddleware } from "@/api/middlewares/cron-auth.middleware";
import { CONFIG_PLUGIN } from "@/config";

export const runCronRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description: "Run cron job",
    path: "/",
    middleware: [cronAuthMiddleware()],
    responses: {
      200: {
        content: {
          "text/plain": {
            schema: z.string(),
          },
        },
        description: "Cron started successfully",
      },
      403: {
        description: "Access Denied",
      },
    },
  },
  handler: c => {
    // biome-ignore lint/suspicious/noConsole: needed for testing cron functionality
    console.log("Cron job triggered", c.get("core").cron);

    return c.text("Not implemented", 200);
  },
});
