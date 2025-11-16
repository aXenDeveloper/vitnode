import { z } from "zod";

import { buildRoute } from "@/api/lib/route";

export const routeMiddlewareSchema = z.object({
  sso: z.array(z.object({ id: z.string(), name: z.string() })),
  isEmail: z.boolean(),
  captcha: z
    .object({
      siteKey: z.string(),
      type: z.enum(["cloudflare_turnstile", "recaptcha_v3"]),
    })
    .optional(),
});

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
        isEmail: !!c.get("core").email?.adapter,
        sso: sso.map(s => ({ id: s.id, name: s.name })),
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
