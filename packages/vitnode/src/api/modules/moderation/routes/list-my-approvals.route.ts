import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/builders";
import { listAuthorContentSubmissions } from "@/content/approvals/server/queue";

import { pageQuery, pageSchema } from "../approvals.schema";
import { json } from "../moderation.schema";

export const myApprovalsRoute = buildRoute({
  route: {
    method: "get",
    path: "/approvals/mine",
    description:
      "The signed-in member's own submissions and what happened to them",
    request: {
      query: z.object({
        ...pageQuery,
        pluginId: z
          .string()
          .min(1)
          .max(255)
          .optional()
          .openapi({ example: "@vitnode/forum" }),
      }),
    },
    responses: {
      200: json(pageSchema, "One page of the member's submissions"),
      401: { description: "Sign in first" },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "Sign in first." });
    const query = c.req.valid("query");
    const { items, total } = await listAuthorContentSubmissions(
      c,
      user.id,
      query,
    );

    return c.json(
      { items, page: query.page, pageSize: query.pageSize, total },
      200,
      { "Cache-Control": "private, no-store" },
    );
  },
});
