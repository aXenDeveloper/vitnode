import { z } from "zod";

import { buildRoute } from "@/api/lib/route";

export const testRoute = buildRoute({
  route: {
    method: "post",
    description: "Test route",
    path: "/test",
    responses: {
      200: {
        content: {
          "text/plain": {
            schema: z.string(),
          },
        },
        description: "User",
      },
      201: {
        content: {
          "text/plain": {
            schema: z.string(),
          },
        },
        description: "User",
      },
    },
  },
  handler: async c => {
    await c.get("log").warn("This is a test warn log");

    return c.text("test");
  },
});
