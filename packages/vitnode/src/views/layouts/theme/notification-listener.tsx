"use client";

import { toast } from "sonner";

import { notificationsChannel } from "@/ws/notifications";
import { useVitNodeWebSocket } from "@/ws/use-websocket";

export const NotificationListener = () => {
  useVitNodeWebSocket(notificationsChannel, {
    onMessage: notification => {
      const options = { description: notification.description };

      switch (notification.type) {
        case "error":
          toast.error(notification.title, options);
          break;
        case "info":
          toast.info(notification.title, options);
          break;
        case "success":
          toast.success(notification.title, options);
          break;
        case "warning":
          toast.warning(notification.title, options);
          break;
        default:
          toast(notification.title, options);
      }
    },
  });

  return null;
};
