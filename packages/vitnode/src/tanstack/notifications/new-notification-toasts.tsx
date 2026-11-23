import type { NotificationStateMessage } from "@vitnode/api/lib/notifications/types";

import { useQueryClient } from "@tanstack/react-query";
import { notificationsStateChannel } from "@vitnode/api/ws/notifications";
import { toast } from "sonner";

import {
  NOTIFICATION_TOAST_CLASS_NAME,
  NotificationToastBanner,
} from "@/views/notifications/notification-toast-banner";
import { recentNotificationsQueryOptions } from "@/views/notifications/notifications-query";
import { useVitNodeWebSocket } from "@/ws/use-websocket";

import { useSessionQuery } from "../auth/session-query";
import { useNotificationActions } from "./actions";

const TYPES_WITH_OWN_LIVE_TOAST = new Set(["core.admin_message"]);
const NOTIFICATION_TOAST_DURATION_MS = 8000;

const NewNotificationToastsForUser = ({ userId }: { userId: number }) => {
  const queryClient = useQueryClient();
  const actions = useNotificationActions(userId);

  const showToast = async (notificationId: number) => {
    const page = await queryClient
      .query({ ...recentNotificationsQueryOptions({ userId }), staleTime: 0 })
      .catch(() => null);
    const item = page?.items.find(entry => entry.id === notificationId);
    if (!item?.unread || TYPES_WITH_OWN_LIVE_TOAST.has(item.type)) return;

    toast.custom(
      id => (
        <NotificationToastBanner
          item={item}
          onOpen={() => {
            toast.dismiss(id);
            actions.open(item, { newTab: false });
          }}
        />
      ),
      {
        classNames: { toast: NOTIFICATION_TOAST_CLASS_NAME },
        duration: NOTIFICATION_TOAST_DURATION_MS,
        id: `notification-${item.id}-${item.activitySeq}`,
      },
    );
  };

  useVitNodeWebSocket(notificationsStateChannel, {
    onMessage: (message: NotificationStateMessage) => {
      if (message.reason !== "created" || message.notificationId === undefined)
        return;

      void showToast(message.notificationId);
    },
  });

  return null;
};

export const NewNotificationToasts = () => {
  const { data: session } = useSessionQuery();
  const userId = session?.user?.id ?? null;

  return userId === null ? null : (
    <NewNotificationToastsForUser key={userId} userId={userId} />
  );
};
