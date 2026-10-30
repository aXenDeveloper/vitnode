import type { Context } from "hono";

import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { writeAuditLogBestEffort } from "@/api/lib/audit/write";
import {
  cancelQueuedNotificationEmails,
  deleteAllNotifications,
  markEverythingRead,
  pauseNotifications,
  resetMemberNotificationPreferences,
  resumeNotifications,
} from "@/api/models/notifications/danger";

/** The danger-zone operations act on every member at once, so each is recorded. */
const auditDanger = async (c: Context, operation: string): Promise<void> => {
  await writeAuditLogBestEffort(c, {
    action: `notifications.${operation}`,
    target: { label: "Notifications", type: "settings", id: "notifications" },
  });
};

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
    await auditDanger(c, "paused");

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
  handler: async c => {
    const result = await resumeNotifications(c);
    await auditDanger(c, "resumed");

    return c.json(result);
  },
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
  handler: async c => {
    const result = await cancelQueuedNotificationEmails(c);
    await auditDanger(c, "emails_cancelled");

    return c.json(result);
  },
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
  handler: async c => {
    const result = await markEverythingRead(c);
    await auditDanger(c, "all_marked_read");

    return c.json(result);
  },
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
  handler: async c => {
    const result = await deleteAllNotifications(c);
    await auditDanger(c, "all_deleted");

    return c.json(result);
  },
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
  handler: async c => {
    const result = await resetMemberNotificationPreferences(c);
    await auditDanger(c, "member_preferences_reset");

    return c.json(result);
  },
});
