import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { manifest } from "@/manifest.gen";

export const helloRoute = buildRoute({
  route: {
    method: "get",
    path: "/",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ message: z.string() }),
          },
        },
        description: "A greeting from the plugin.",
      },
    },
  },
  handler: c => c.json({ message: `Hello from ${manifest.id}!` }),
});
