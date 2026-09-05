import { CONFIG_PLUGIN } from "@/config";

import { createWebSocketChannel } from "./types";

export type VitNodeNotificationType = "error" | "info" | "success" | "warning";

/** A notification pushed to a single user over the WebSocket. */
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
