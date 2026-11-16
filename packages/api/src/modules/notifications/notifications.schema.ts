import { z } from "zod";

import { NOTIFICATION_EMAIL_MODES } from "@/lib/notifications/types";

export const zodNotificationState = z.object({
  revision: z.number(),
  unread: z.number(),
});

const zodNotificationSubject = z.object({
  id: z.string(),
  type: z.string(),
});

const zodNotificationActor = z.object({
  avatarColor: z.string(),
  avatarUrl: z.string().nullable(),
  id: z.number(),
  name: z.string(),
  nameCode: z.string(),
});

export const zodNotificationItem = z.object({
  activitySeq: z.number(),
  actorCount: z.number(),
  actors: z.array(zodNotificationActor),
  available: z.boolean(),
  body: z.string().nullable(),
  category: z.string(),
  createdAt: z.date(),
  eventCount: z.number(),
  id: z.number(),
  lastActivityAt: z.date(),
  pluginId: z.string(),
  readAt: z.date().nullable(),
  subject: zodNotificationSubject.nullable(),
  target: z.string().nullable(),
  title: z.string(),
  type: z.string(),
  unread: z.boolean(),
});

export const zodNotificationEmailMode = z.enum(NOTIFICATION_EMAIL_MODES);

export const zodNotificationIdParams = z.object({
  id: z.coerce.number().int().positive(),
});

export const unauthorizedResponse = {
  401: { description: "Not signed in" },
} as const;

export const stateResponse = {
  200: {
    content: { "application/json": { schema: zodNotificationState } },
    description: "The unread state after the change",
  },
  404: { description: "No such notification for this user" },
  ...unauthorizedResponse,
} as const;

export const zodNotificationPreferences = z.object({
  types: z.array(
    z.object({
      category: z.string(),
      categoryLabel: z.string(),
      defaultEmail: zodNotificationEmailMode,
      description: z.string().nullable(),
      emailModes: z.array(zodNotificationEmailMode),
      id: z.string(),
      inAppAvailable: z.boolean(),
      label: z.string(),
      locked: z.boolean(),
      mandatory: z.boolean(),
      pluginId: z.string(),
      pushAvailable: z.boolean(),
      value: z.object({
        email: zodNotificationEmailMode,
        inApp: z.boolean(),
        push: z.boolean(),
      }),
    }),
  ),
});

export const zodUpdateNotificationPreferences = z.object({
  types: z
    .record(
      z.string().max(100),
      z.object({
        email: zodNotificationEmailMode.optional(),
        inApp: z.boolean().optional(),
        push: z.boolean().optional(),
      }),
    )
    .optional(),
});
