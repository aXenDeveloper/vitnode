import { z } from "zod";

import { CONFIG_PLUGIN } from "@/config";
import { INSECURE_DEFAULT_CRON_SECRET } from "@/lib/config";
import { isRealtimePubSubEnabled, isWebSocketEnabled } from "@/ws/registry";

import { buildRoute } from "../../../../lib/route";

export const integrationsDebugAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "system", permission: "can_view" },
  route: {
    method: "get",
    description:
      "Report whether the core integrations (WebSocket, Redis, Email, Captcha, Cron) are active on the server.",
    path: "/integrations",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              captcha: z.object({
                active: z.boolean(),
                type: z
                  .enum(["cloudflare_turnstile", "recaptcha_v3"])
                  .nullable(),
              }),
              cron: z.object({
                // `true` when a cron adapter is configured, i.e. an in-process
                // scheduler is running the registered jobs automatically.
                active: z.boolean(),
                // Registered cron jobs. Always >= 1 since core ships a job.
                jobs: z.number(),
                // `false` when `CRON_SECRET` is left at its well-known default,
                // which leaves the cron endpoint effectively unauthenticated.
                secure: z.boolean(),
              }),
              email: z.object({
                active: z.boolean(),
              }),
              redis: z.object({
                active: z.boolean(),
                // `true` when Redis is configured but currently unreachable — a
                // problem worth surfacing distinctly from "not set up at all".
                configuredButDown: z.boolean(),
              }),
              websocket: z.object({
                active: z.boolean(),
                crossInstance: z.boolean(),
              }),
            }),
          },
        },
        description: "Integration statuses",
      },
    },
  },
  handler: async c => {
    const core = c.get("core");
    const captcha = core.captcha;
    const redis = await c.get("cache").status();

    return c.json(
      {
        captcha: {
          active: !!(captcha?.secretKey && captcha.siteKey),
          type: captcha?.type ?? null,
        },
        cron: {
          active: core.hasCronAdapter,
          jobs: core.cron.length,
          secure:
            !!core.cronSecret &&
            core.cronSecret !== INSECURE_DEFAULT_CRON_SECRET,
        },
        email: {
          active: !!core.email?.adapter,
        },
        redis: {
          active: redis.configured && redis.connected,
          configuredButDown: redis.configured && !redis.connected,
        },
        websocket: {
          active: isWebSocketEnabled(),
          crossInstance: isRealtimePubSubEnabled(),
        },
      },
      200,
    );
  },
});
