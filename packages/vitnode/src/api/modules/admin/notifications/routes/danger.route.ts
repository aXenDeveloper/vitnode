import { z } from "zod";

import { buildRoute } from "@/api/builders";
import {
  cancelQueuedNotificationEmails,
  deleteAllNotifications,
  markEverythingRead,
  pauseNotifications,
  resetMemberNotificationPreferences,
  resumeNotifications,
} from "@/api/models/notifications/danger";

const canManageNotifications = {
  module: "notifications",
  permission: "can_manage",
} as const;

const dangerResponses = <T extends z.ZodType>(schema: T, description: string) =>
  ({
    200: { content: { "application/json": { schema } }, description },
    403: { description: "Access Denied" },
  }) as const;

export const pauseNotificationsRoute = buildRoute({
  adminStaffPermission: canManageNotifications,
  route: {
    method: "post",
    description:
      "Stop fanning out and sending notifications. New events are still stored and wait until notifications resume.",
    path: "/pause",
    responses: dangerResponses(z.object({ success: z.boolean() }), "Paused"),
  },
  handler: async c => {
    await pauseNotifications(c);

    return c.json({ success: true });
  },
});

export const resumeNotificationsRoute = buildRoute({
  adminStaffPermission: canManageNotifications,
  route: {
    method: "post",
    description:
      "Resume notifications and queue every event that waited while they were paused.",
    path: "/resume",
    responses: dangerResponses(
      z.object({ requeuedEvents: z.number() }),
      "Resumed",
    ),
  },
  handler: async c => c.json(await resumeNotifications(c)),
});

export const cancelQueuedNotificationEmailsRoute = buildRoute({
  adminStaffPermission: canManageNotifications,
  route: {
    method: "post",
    description:
      "Skip every email that has not gone out yet, including the next digests. In-app notifications stay.",
    path: "/emails/cancel",
    responses: dangerResponses(
      z.object({ cancelled: z.number() }),
      "Cancelled",
    ),
  },
  handler: async c => c.json(await cancelQueuedNotificationEmails(c)),
});

export const markEverythingReadRoute = buildRoute({
  adminStaffPermission: canManageNotifications,
  route: {
    method: "post",
    description:
      "Mark every unread notification as read for every member and zero their badges.",
    path: "/read-all",
    responses: dangerResponses(
      z.object({ items: z.number(), members: z.number() }),
      "Marked as read",
    ),
  },
  handler: async c => c.json(await markEverythingRead(c)),
});

export const deleteAllNotificationsRoute = buildRoute({
  adminStaffPermission: canManageNotifications,
  route: {
    method: "post",
    description:
      "Delete every member's notifications. Types, preferences, settings and email history are kept.",
    path: "/delete-all",
    responses: dangerResponses(
      z.object({ events: z.number(), items: z.number() }),
      "Deleted",
    ),
  },
  handler: async c => c.json(await deleteAllNotifications(c)),
});

export const resetMemberNotificationPreferencesRoute = buildRoute({
  adminStaffPermission: canManageNotifications,
  route: {
    method: "post",
    description:
      "Drop every member's own notification choices and digest schedule so they follow the installation defaults.",
    path: "/members/reset-preferences",
    responses: dangerResponses(z.object({ members: z.number() }), "Reset"),
  },
  handler: async c => c.json(await resetMemberNotificationPreferences(c)),
});
