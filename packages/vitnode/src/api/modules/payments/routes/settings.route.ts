import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { publicPaymentsSettings } from "@/payments/config";

import { zodPaymentsSettings } from "../schema";

export const paymentsSettingsRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description:
      "Whether Payments is enabled, and the currencies and providers the UI may offer. Never includes keys or secrets.",
    path: "/settings",
    responses: {
      200: {
        content: { "application/json": { schema: zodPaymentsSettings } },
        description: "Public payments settings",
      },
    },
  },
  handler: c =>
    c.json(
      zodPaymentsSettings.parse(
        publicPaymentsSettings(c.get("core").payments.config),
      ),
    ),
});
