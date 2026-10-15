import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/builders";
import {
  resolveUserImagePolicy,
  zodUserImagePolicy,
} from "@/api/lib/user-images";

export const userImagePolicyRoute = buildRoute({
  route: {
    method: "get",
    description:
      "What the signed-in user may upload as an avatar and a cover, from their roles.",
    path: "/policy",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: zodUserImagePolicy,
          },
        },
        description: "Per-image allowance and size cap",
      },
      401: {
        description: "Not signed in",
      },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    return c.json(await resolveUserImagePolicy(c, user), 200);
  },
});
