import { z } from "zod";

import { buildQueueTask } from "@/api/builders";

export const sendEmailPayloadSchema = z.object({
  to: z.string(),
  subject: z.string(),
  html: z.string(),
  text: z.string(),
  replyTo: z.string().optional(),
});

export const sendEmailQueueTask = buildQueueTask({
  name: "send-email",
  payload: sendEmailPayloadSchema,
  description: "Deliver a rendered email through the configured provider.",
  handler: async (c, email) => {
    await c.get("email").deliver(email);
  },
});
