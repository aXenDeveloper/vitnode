import type { NotificationStateMessage } from "@/lib/notifications/types";

import { CONFIG_PLUGIN } from "@/config";

import { createWebSocketChannel } from "./types";

export type VitNodeNotificationType = "error" | "info" | "success" | "warning";

/**
 * A transient toast pushed to a single user over the WebSocket. Persistent
 * notifications go through `c.get("notifications").publish` instead.
 */
export interface VitNodeNotification {
  description?: string;
  title: string;
  type?: VitNodeNotificationType;
}

export const notificationsChannel = createWebSocketChannel<
  never,
  VitNodeNotification
>({
  id: "inbox",
  module: "notifications",
  pluginId: CONFIG_PLUGIN.pluginId,
});

/**
 * The canonical unread state of the signed-in user. Every committed inbox
 * change sends the absolute count with a per-user revision, never a +1/-1.
 */
export const notificationsStateChannel = createWebSocketChannel<
  never,
  NotificationStateMessage
>({
  id: "state",
  module: "notifications",
  pluginId: CONFIG_PLUGIN.pluginId,
});
