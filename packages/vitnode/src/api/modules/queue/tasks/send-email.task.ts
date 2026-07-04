import { z } from "zod";

import { buildQueueTask } from "@/api/lib/queue";
import { EmailModel } from "@/api/models/email";

export const sendEmailPayloadSchema = z.object({
  to: z.string(),
  subject: z.string(),
  html: z.string(),
  text: z.string(),
  replyTo: z.string().optional(),
});

export const sendEmailQueueTask = buildQueueTask({
  name: "send-email",
  description: "Deliver a rendered email through the configured provider.",
  handler: async (c, payload) => {
    const email = sendEmailPayloadSchema.parse(payload);

    await new EmailModel(c).deliver(email);
  },
});
