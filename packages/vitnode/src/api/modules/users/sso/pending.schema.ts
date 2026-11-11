import { z } from "zod";

export const zodPendingError = z.object({
  error: z.enum(["invalid_link", "invalid_pending", "too_many_emails"]),
});

export const providerParams = z.object({
  providerId: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[\w-]+$/),
});
