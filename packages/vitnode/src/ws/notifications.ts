import { CONFIG_PLUGIN } from "@/config";

import { createWebSocketChannel } from "./types";

export type VitNodeNotificationType = "error" | "info" | "success" | "warning";

/** A notification pushed to a single user over the WebSocket. */
export interface VitNodeNotification {
  description?: string;
  title: string;
  type?: VitNodeNotificationType;
}

/**
 * Per-user notification channel. Every user subscribes to the same id, but the
 * server delivers each notification only to the target user's connections (see
 * `realtime.sendToUser`), so notifications never leak to other users.
 *
 * Public id: `@vitnode/core_notifications_inbox`.
 */
export const notificationsChannel = createWebSocketChannel<
  never,
  VitNodeNotification
>({
  id: "inbox",
  module: "notifications",
  pluginId: CONFIG_PLUGIN.pluginId,
});
