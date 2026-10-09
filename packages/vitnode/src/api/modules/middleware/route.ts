import { z } from "zod";

import { AI_MODEL_CAPABILITIES } from "@/api/lib/ai/capabilities";
import { buildRoute } from "@/api/lib/route";
import { loadPublicNavigationMenus } from "@/api/modules/admin/navigation/lib/cache";
import {
  zodPublicNavigationItemSchema,
  zodPublicNavigationNodeSchema,
} from "@/api/modules/admin/navigation/lib/schema";
import { CONFIG_PLUGIN } from "@/config";

export const routeMiddlewareSchema = z.object({
  ai: z.object({
    models: z.array(
      z.object({
        capabilities: z.array(z.enum(AI_MODEL_CAPABILITIES)),
        id: z.string(),
        model: z.string(),
        name: z.string(),
        provider: z.string(),
      }),
    ),
  }),
  sso: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      icon: z.string().optional(),
      brandColor: z.string().optional(),
    }),
  ),
  isEmail: z.boolean(),
  passkeys: z.boolean(),
  password: z.boolean(),
  navigation: z.array(zodPublicNavigationNodeSchema),
  bottomBar: z.array(zodPublicNavigationItemSchema),
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
    const { bottomBar, navigation } = await loadPublicNavigationMenus(c);

    return c.json(
      {
        ai: { models: c.get("ai").models() },
        isEmail: !!c.get("core").email?.adapter,
        passkeys: c.get("core").authorization.passkeys.enabled,
        password: c.get("core").authorization.password.enabled,
        navigation,
        bottomBar,
        sso: sso.map(s => ({
          id: s.id,
          name: s.name,
          icon: s.icon,
          brandColor: s.brandColor,
        })),
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
