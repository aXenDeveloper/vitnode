import { buildRoute } from "@/api/builders";

import { routeMiddlewareSchema } from "../middleware.schema";

export const routeMiddleware = buildRoute({
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
  handler: c => {
    const sso = c.get("core").authorization.ssoAdapters;

    return c.json(
      {
        ai: { models: c.get("ai").models() },
        isEmail: !!c.get("core").email?.adapter,
        passkeys: c.get("core").authorization.passkeys.enabled,
        password: c.get("core").authorization.password.enabled,
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
