import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/builders";
import { zodLegalMemberState } from "@/lib/legal/contract";
import { loadMemberLegalState } from "@/lib/legal/state.server";

export const meLegalRoute = buildRoute({
  termsAcceptance: "exempt",
  route: {
    method: "get",
    description:
      "The signed-in member's legal state: the Terms version they must accept (if any) and the informational notices they have not dismissed.",
    path: "/me",
    responses: {
      200: {
        content: { "application/json": { schema: zodLegalMemberState } },
        description: "Legal state",
      },
      401: { description: "Not signed in" },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401);
    c.header("Cache-Control", "private, no-store");

    return c.json(await loadMemberLegalState(c, user), 200);
  },
});
