import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/builders";
import { legalTermsAcceptedEvent } from "@/events/legal";
import {
  defaultTermsWording,
  recordTermsAcceptance,
} from "@/lib/legal/acceptance.server";
import { zodLegalAcceptBody } from "@/lib/legal/contract";
import { invalidateLegalCaches } from "@/lib/legal/state.server";

export const acceptLegalRoute = buildRoute({
  termsAcceptance: "exempt",
  route: {
    method: "post",
    description:
      "Accept the effective Terms of Service version the member was shown. Repeating it for the same version returns the first record. A version that is no longer effective answers `409 TERMS_VERSION_CHANGED` with the current one.",
    path: "/accept",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: zodLegalAcceptBody } },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              acceptedAt: z.string(),
              created: z.boolean(),
              version: z.number().int(),
              versionId: z.number().int(),
            }),
          },
        },
        description: "Accepted",
      },
      401: { description: "Not signed in" },
      409: { description: "`TERMS_VERSION_CHANGED`" },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401);
    const { locale, versionId } = c.req.valid("json");

    const recorded = await c
      .get("db")
      .transaction(
        async tx =>
          await recordTermsAcceptance(
            tx,
            { locale, source: "gate", userId: user.id, versionId },
            defaultTermsWording(c),
          ),
      );
    await invalidateLegalCaches(c, []);
    if (recorded.created) {
      await c.get("events").emit(legalTermsAcceptedEvent, {
        source: "gate",
        userId: user.id,
        version: recorded.version,
        versionId,
      });
    }
    c.header("Cache-Control", "no-store");

    return c.json(
      {
        acceptedAt: recorded.acceptedAt.toISOString(),
        created: recorded.created,
        version: recorded.version,
        versionId,
      },
      200,
    );
  },
});
