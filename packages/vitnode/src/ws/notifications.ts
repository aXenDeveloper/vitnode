import type { NotificationStateMessage } from "@/lib/notifications/types";

import { manifest } from "@/manifest";

import { createWebSocketChannel } from "./types";

export type VitNodeNotificationType = "error" | "info" | "success" | "warning";

/** A notification pushed to a single user over the WebSocket. */
export interface VitNodeNotification {
  /** Shown under the title. */
  description?: string;
  title: string;
  /** The toast's style; a plain toast when omitted. */
  type?: VitNodeNotificationType;
}

/**
 * Core's channel for transient toast notifications to one user: send with
 * `c.get("realtime").sendToUser(userId, notificationsChannel, { title, … })`.
 * They reach open tabs only and are gone on reload; for a persistent inbox
 * entry use `c.get("notifications").publish()`.
 */
export const notificationsChannel = createWebSocketChannel<
  never,
  VitNodeNotification
>({
  id: "inbox",
  module: "notifications",
  pluginId: manifest.id,
});

export const notificationsStateChannel = createWebSocketChannel<
  never,
  NotificationStateMessage
>({
  id: "state",
  module: "notifications",
  pluginId: manifest.id,
});
