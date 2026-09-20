import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { loadPublicNavigation } from "@/api/modules/admin/navigation/lib/cache";
import { zodPublicNavigationNodeSchema } from "@/api/modules/admin/navigation/lib/schema";
import { CONFIG_PLUGIN } from "@/config";

export const routeMiddlewareSchema = z.object({
  ai: z.object({
    models: z.array(
      z.object({
        id: z.string(),
        model: z.string(),
        name: z.string(),
      }),
    ),
  }),
  sso: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      icon: z.string().optional(),
    }),
  ),
  isEmail: z.boolean(),
  navigation: z.array(zodPublicNavigationNodeSchema),
  captcha: z
    .object({
      siteKey: z.string(),
      type: z.enum(["cloudflare_turnstile", "recaptcha_v3"]),
    })
    .optional(),
});

export const routeMiddleware = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    path: "/",
    method: "get",
    description: "Middleware route with user authentication",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: routeMiddlewareSchema,
          },
        },
        description: "Middleware route",
      },
    },
  },
  handler: async c => {
    const sso = c.get("core").authorization.ssoAdapters;

    return c.json(
      {
        ai: { models: c.get("ai").models() },
        isEmail: !!c.get("core").email?.adapter,
        navigation: await loadPublicNavigation(c),
        sso: sso.map(s => ({ id: s.id, name: s.name, icon: s.icon })),
        captcha: c.get("core").captcha
          ? {
              siteKey: c.get("core").captcha?.siteKey ?? "",
              type: c.get("core").captcha?.type ?? "cloudflare_turnstile",
            }
          : undefined,
      },
      200,
    );
  },
});
