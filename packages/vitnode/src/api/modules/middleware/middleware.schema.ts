import { z } from "zod";

import { AI_MODEL_CAPABILITIES } from "@/api/lib/ai/capabilities";

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
  captcha: z
    .object({
      siteKey: z.string(),
      type: z.enum(["cloudflare_turnstile", "recaptcha_v3"]),
    })
    .optional(),
});
