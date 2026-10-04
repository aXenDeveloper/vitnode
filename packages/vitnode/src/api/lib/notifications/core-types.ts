import { z } from "zod";

import { buildNotificationType } from "./registry";

/**
 * A message an administrator sends a user from the dashboard widget. Before
 * the Notifications Center it was a toast that vanished on reload; now it
 * also lands in the inbox.
 */
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
  // No target: the whole message is the item, so clicking it only marks it read.
  present: ({ data }) => ({ body: data.description, title: data.title }),
});

export const coreNotificationTypes = [adminMessageNotification];
