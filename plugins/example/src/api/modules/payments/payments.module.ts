import type { Context } from "hono";

import { buildModule } from "@vitnode/core/api/lib/module";
import { buildRoute } from "@vitnode/core/api/lib/route";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { createHash } from "node:crypto";
import { z } from "zod";

import { exampleOffers } from "@/api/payments/offers";
import { hasActiveAccess } from "@/api/payments/policy";
import { CONFIG_PLUGIN } from "@/const";
import { example_payments_access } from "@/database/payments";

const OFFER_IDS = ["lifetime-pass", "pro-plan"] as const;

const zodAccess = z.object({
  accessUntil: z.date().nullable(),
  active: z.boolean(),
});

const readGrant = async (c: Context, userId: number, offerId: string) => {
  const [grant] = await c
    .get("db")
    .select()
    .from(example_payments_access)
    .where(
      and(
        eq(example_payments_access.userId, userId),
        eq(example_payments_access.offerId, offerId),
      ),
    );

  return grant;
};

const accessRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description:
      "What the signed-in user can use from the example offers. Expiry is checked here, on every read.",
    path: "/access",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              "lifetime-pass": zodAccess,
              "pro-plan": zodAccess,
              signedIn: z.boolean(),
            }),
          },
        },
        description: "Access per offer",
      },
    },
  },
  handler: async c => {
    c.header("Cache-Control", "private, no-store");
    const user = c.get("user");
    const now = new Date();
    const access = async (offerId: (typeof OFFER_IDS)[number]) => {
      const grant = user ? await readGrant(c, user.id, offerId) : undefined;

      return {
        accessUntil: grant?.accessUntil ?? null,
        active: hasActiveAccess(grant, now),
      };
    };

    return c.json({
      "lifetime-pass": await access("lifetime-pass"),
      "pro-plan": await access("pro-plan"),
      signedIn: !!user,
    });
  },
});

/**
 * The protected feature. The content is produced here, only for a user whose
 * grant is active right now - the page never receives it otherwise.
 */
const featureRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description: "A members-only certificate for an example offer.",
    path: "/features/{offerId}",
    request: { params: z.object({ offerId: z.enum(OFFER_IDS) }) },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              holder: z.string(),
              issuedAt: z.date(),
              serial: z.string(),
              validUntil: z.date().nullable(),
            }),
          },
        },
        description: "The unlocked feature",
      },
      401: { description: "Not signed in" },
      403: { description: "No active access to this offer" },
    },
  },
  handler: async c => {
    c.header("Cache-Control", "private, no-store");
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "Sign in first." });

    const { offerId } = c.req.valid("param");
    const grant = await readGrant(c, user.id, offerId);

    if (!grant || !hasActiveAccess(grant)) {
      throw new HTTPException(403, {
        message: "This feature unlocks after a confirmed payment.",
      });
    }

    return c.json({
      holder: user.name,
      issuedAt: grant.createdAt,
      serial: createHash("sha256")
        .update(`${grant.purchaseId}:${offerId}`)
        .digest("hex")
        .slice(0, 12)
        .toUpperCase(),
      validUntil: grant.accessUntil,
    });
  },
});

export const paymentsModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "payments",
  routes: [accessRoute, featureRoute],
  paymentOffers: exampleOffers,
});
