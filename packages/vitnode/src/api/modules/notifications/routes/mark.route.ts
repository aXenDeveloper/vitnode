import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import {
  archiveNotification,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from "@/api/models/notifications/inbox";
import { CONFIG_PLUGIN } from "@/config";

import {
  requireNotificationUser,
  unauthorizedResponse,
  zodNotificationIdParams,
  zodNotificationState,
} from "../schema";

const stateResponse = {
  200: {
    content: { "application/json": { schema: zodNotificationState } },
    description: "The unread state after the change",
  },
  404: { description: "No such notification for this user" },
  ...unauthorizedResponse,
} as const;

export const markNotificationReadRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description:
      "Mark one notification read, up to the activity the user saw. Repeating it changes nothing.",
    path: "/{id}/read",
    request: {
      params: zodNotificationIdParams,
      body: {
        required: false,
        content: {
          "application/json": {
            schema: z.object({
              /** The `activitySeq` the client rendered. */
              throughSeq: z.number().int().min(1).optional(),
            }),
          },
        },
      },
    },
    responses: stateResponse,
  },
  handler: async c => {
    const user = requireNotificationUser(c);
    const { id } = c.req.valid("param");
    const body = c.req.header("content-type")?.includes("application/json")
      ? c.req.valid("json")
      : {};

    return c.json(
      await markNotificationRead(c, {
        notificationId: id,
        throughSeq: body.throughSeq,
        userId: user.id,
      }),
    );
  },
});

export const markNotificationUnreadRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description: "Mark one notification unread again.",
    path: "/{id}/unread",
    request: { params: zodNotificationIdParams },
    responses: stateResponse,
  },
  handler: async c => {
    const user = requireNotificationUser(c);
    const { id } = c.req.valid("param");

    return c.json(
      await markNotificationUnread(c, { notificationId: id, userId: user.id }),
    );
  },
});

export const archiveNotificationRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description:
      "Archive one notification. It leaves the inbox and the unread count; new activity brings it back.",
    path: "/{id}/archive",
    request: { params: zodNotificationIdParams },
    responses: stateResponse,
  },
  handler: async c => {
    const user = requireNotificationUser(c);
    const { id } = c.req.valid("param");

    return c.json(
      await archiveNotification(c, { notificationId: id, userId: user.id }),
    );
  },
});

export const markAllNotificationsReadRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description:
      "Mark every notification read that exists when the request takes the user's lock. Anything delivered after stays unread.",
    path: "/read-all",
    request: {
      body: {
        required: false,
        content: {
          "application/json": {
            schema: z.object({ category: z.string().max(50).optional() }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: zodNotificationState.extend({ marked: z.number() }),
          },
        },
        description: "The unread state after the change",
      },
      ...unauthorizedResponse,
    },
  },
  handler: async c => {
    const user = requireNotificationUser(c);
    const body = c.req.header("content-type")?.includes("application/json")
      ? c.req.valid("json")
      : {};

    return c.json(
      await markAllNotificationsRead(c, {
        category: body.category,
        userId: user.id,
      }),
    );
  },
});
