import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/builders";
import {
  loadMentionedUsers,
  MENTIONED_USERS_MAX_IDS,
} from "@/models/mentions/users";

const parseIds = (value: string): number[] => [
  ...new Set(
    value
      .split(",")
      .map(Number)
      .filter(id => id > 0 && id <= 2_147_483_647),
  ),
];

export const mentionedUsersRoute = buildRoute({
  route: {
    method: "get",
    description: `Current name and URL name of up to ${MENTIONED_USERS_MAX_IDS} mentioned members, so \`@mentions\` keep linking after a rename. Deleted members are left out.`,
    path: "/mentioned",
    request: {
      query: z.object({
        ids: z
          .string()
          .max(MENTIONED_USERS_MAX_IDS * 11)
          .regex(/^\d{1,10}(?:,\d{1,10})*$/)
          .openapi({ example: "1,2,3" }),
      }),
    },
    responses: {
      400: {
        description: `No valid id, or more than ${MENTIONED_USERS_MAX_IDS}`,
      },
      200: {
        content: {
          "application/json": {
            schema: z.object({
              users: z.array(
                z.object({
                  id: z.number(),
                  name: z.string(),
                  nameCode: z.string(),
                }),
              ),
            }),
          },
        },
        description: "Members found",
      },
    },
  },
  handler: async c => {
    const ids = parseIds(c.req.valid("query").ids);
    if (ids.length === 0 || ids.length > MENTIONED_USERS_MAX_IDS) {
      throw new HTTPException(400, { message: "Invalid ids" });
    }
    const users = await loadMentionedUsers(c, ids);

    return c.json({ users }, 200, { "Cache-Control": "private, max-age=60" });
  },
});
