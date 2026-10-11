import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { createPortalSession } from "@/api/models/payments/checkout";
import {
  findRegisteredOffer,
  requirePaymentsUser,
} from "@/api/models/payments/shared";
import { CONFIG_PLUGIN } from "@/config";

import { privateResponse } from "../private-response";
import { paymentsErrorResponses } from "../schema";

/** Where billing settings live - the portal's default way back. */
export const BILLING_SETTINGS_PATH = "/settings/billing";

export const portalRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description:
      "Open the provider's billing portal for the signed-in user's own billing account. The return destination is either billing settings or an offer's declared page - never a URL from the request.",
    path: "/portal",
    middleware: [privateResponse],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              provider: z.string().max(32).optional(),
              returnTo: z
                .object({
                  offerId: z.string().min(1).max(64),
                  pluginId: z.string().min(1).max(100),
                })
                .optional(),
            }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ url: z.string() }) },
        },
        description: "The portal URL to send the user to",
      },
      ...paymentsErrorResponses,
    },
  },
  handler: async c => {
    const user = requirePaymentsUser(c);
    const { provider, returnTo } = c.req.valid("json");
    const offer = returnTo
      ? findRegisteredOffer(c, returnTo.pluginId, returnTo.offerId)
      : undefined;

    const url = await createPortalSession(c, user.id, {
      providerId: provider,
      returnPath: offer?.offer.returnPath ?? BILLING_SETTINGS_PATH,
    });

    return c.json({ url });
  },
});
