import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/builders";
import { UserPresenceModel } from "@/models/user-presence";

export const presenceHeartbeatRoute = buildRoute({
  // Polled by every open tab, the acceptance page included. It only marks the
  // member as online, so it stays open while Terms acceptance is pending.
  termsAcceptance: "exempt",
  route: {
    method: "post",
    description:
      "Keep the signed-in session online. Sent by open, visible tabs about once a minute; the member and the session come from the session cookie, never the body.",
    path: "/presence/heartbeat",
    responses: {
      204: { description: "Presence renewed" },
      401: { description: "Not signed in, or the session has expired" },
    },
  },
  handler: async c => {
    const user = c.get("user");
    const presence = new UserPresenceModel(c);
    const sessionId = await presence.currentSessionId();
    if (!(user && sessionId)) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    await presence.heartbeat({ sessionId, userId: user.id });

    return c.body(null, 204);
  },
});
