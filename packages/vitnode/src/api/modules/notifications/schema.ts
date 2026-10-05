import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";

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

export const requireNotificationUser = (c: Context<EnvVitNode>) => {
  const user = c.get("user");
  if (!user) throw new HTTPException(401, { message: "Unauthorized" });

  return user;
};
