import { z } from '@hono/zod-openapi';

export const ShowMiddlewareObj = z.object({
  is_ai_enabled: z.boolean(),
  is_email_enabled: z.boolean(),
  languages_code_default: z.string(),
  last_updated: z.date(),
  plugins: z.array(z.string()),
  plugin_code_default: z.string(),
});
