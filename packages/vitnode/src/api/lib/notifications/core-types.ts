import { z } from "zod";

import { buildNotificationType } from "./registry";

export const adminMessageNotification = buildNotificationType({
  id: "core.admin_message",
  version: 1,
  schema: z.object({
    description: z.string().max(1000).optional(),
    title: z.string().min(1).max(200),
  }),
  category: "system",
  label: "core.notifications.types.admin_message.label",
  description: "core.notifications.types.admin_message.description",
  defaults: { email: "none", inApp: true },
  present: ({ data }) => ({ body: data.description, title: data.title }),
});

export const coreNotificationTypes = [adminMessageNotification];
