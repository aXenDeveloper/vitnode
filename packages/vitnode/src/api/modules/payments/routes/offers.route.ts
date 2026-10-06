import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { purchasablePrices } from "@/payments/config";
import { BILLING_INTERVALS, OFFER_MODES } from "@/payments/status";

export const paymentOffersRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description:
      "The offers a plugin sells, with only the prices a buyer can choose right now: the offer's explicit prices intersected with the enabled currencies and the provider's capabilities.",
    path: "/offers",
    request: {
      query: z.object({
        pluginId: z.string().min(1).max(100),
        provider: z.string().max(32).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              enabled: z.boolean(),
              offers: z.array(
                z.object({
                  id: z.string(),
                  mode: z.enum(OFFER_MODES),
                  name: z.string(),
                  nameKey: z.string().nullable(),
                  pluginId: z.string(),
                  prices: z.array(
                    z.object({
                      amount: z.number().int(),
                      currency: z.string(),
                      interval: z.enum(BILLING_INTERVALS).nullable(),
                    }),
                  ),
                }),
              ),
            }),
          },
        },
        description: "Offers and their purchasable prices",
      },
    },
  },
  handler: c => {
    const { pluginId, provider: providerId } = c.req.valid("query");
    const { config, offers } = c.get("core").payments;
    const provider = config
      ? providerId
        ? config.providers.find(item => item.id === providerId)
        : config.defaultProvider
      : undefined;

    return c.json({
      enabled: !!config,
      offers: [...offers.values()]
        .filter(entry => entry.pluginId === pluginId)
        .map(({ offer }) => ({
          id: offer.id,
          mode: offer.mode,
          name: offer.name,
          nameKey: offer.nameKey ?? null,
          pluginId,
          prices:
            config && provider
              ? purchasablePrices(config, provider, offer)
              : [],
        })),
    });
  },
});
