import { z } from "zod";

import { manifest } from "@/manifest";

import { defineEvent } from "../lib/event-definition";

const pluginId = manifest.id;

export const notificationsDeletedAllEvent = defineEvent({
  pluginId,
  name: "notifications.deleted_all",
  payload: z.object({ items: z.number().int() }),
});

export const notificationsEmailsCancelledEvent = defineEvent({
  pluginId,
  name: "notifications.emails_cancelled",
  payload: z.object({ count: z.number().int() }),
});

export const notificationsPausedEvent = defineEvent({
  pluginId,
  name: "notifications.paused",
  payload: z.object({}),
});

export const notificationsPreferencesResetEvent = defineEvent({
  pluginId,
  name: "notifications.preferences_reset",
  payload: z.object({ members: z.number().int() }),
});

export const notificationsPreferencesUpdatedEvent = defineEvent({
  pluginId,
  name: "notifications.preferences_updated",
  payload: z.object({
    typeIds: z.array(z.string()),
    userId: z.number().int(),
  }),
});

export const notificationsReadAllEvent = defineEvent({
  pluginId,
  name: "notifications.read_all",
  payload: z.object({
    items: z.number().int(),
    members: z.number().int(),
  }),
});

export const notificationsResumedEvent = defineEvent({
  pluginId,
  name: "notifications.resumed",
  payload: z.object({ requeuedEvents: z.number().int() }),
});

export const notificationTypeUpdatedEvent = defineEvent({
  pluginId,
  name: "notifications.type.updated",
  payload: z.object({ typeId: z.string() }),
});

/** Every `notifications.*` event core defines. */
export const notificationEventDefinitions = [
  notificationsDeletedAllEvent,
  notificationsEmailsCancelledEvent,
  notificationsPausedEvent,
  notificationsPreferencesResetEvent,
  notificationsPreferencesUpdatedEvent,
  notificationsReadAllEvent,
  notificationsResumedEvent,
  notificationTypeUpdatedEvent,
];
