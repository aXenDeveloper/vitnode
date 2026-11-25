import { z } from "zod";

import { buildRoute } from "@/builders";
import { releaseAccountDeletionHold } from "@/lib/account-deletion/sign-in-hold";
import { SessionModel } from "@/models/session";

export const zodCancelDeletionSignInSchema = z.object({
  token: z.string().min(16).max(2048),
});

export const cancelDeletionSignInRoute = buildRoute({
  termsAcceptance: "exempt",
  route: {
    method: "post",
    description:
      "Finish a sign-in that was held because the account is scheduled for deletion: cancels the deletion and starts a normal session. `token` is the one a sign-in answered with alongside `account_deletion_pending`; it lasts 10 minutes and works once.",
    path: "/sign_in/cancel-deletion",
    request: {
      body: {
        required: true,
        content: {
          "application/json": { schema: zodCancelDeletionSignInSchema },
        },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": { schema: z.object({ id: z.number() }) },
        },
        description: "Deletion cancelled and user signed in",
      },
      400: {
        content: {
          "application/json": {
            schema: z.object({ error: z.literal("invalid_hold") }),
          },
        },
        description:
          "The token is invalid, expired, already used, or the deletion is no longer pending",
      },
    },
  },
  handler: async c => {
    const { token } = c.req.valid("json");
    const userId = await releaseAccountDeletionHold(c, token);

    if (userId === null) {
      return c.json({ error: "invalid_hold" as const }, 400);
    }

    await new SessionModel(c).createSessionByUserId(userId);

    return c.json({ id: userId }, 201);
  },
});
