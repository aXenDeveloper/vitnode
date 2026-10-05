import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { NotificationState } from "@/lib/notifications/types";
import type { NotificationItemView } from "@/views/notifications/notifications-query";

import { notificationStateStore } from "@/views/notifications/notification-state-store";
import {
  archiveNotificationInBrowser,
  markAllNotificationsReadInBrowser,
  markNotificationReadInBrowser,
  markNotificationUnreadInBrowser,
} from "@/views/notifications/notifications-actions";
import { fetchNotificationState } from "@/views/notifications/notifications-query";

import {
  invalidateNotificationLists,
  markAllCachedRead,
  patchCachedNotification,
} from "./cache";

export const useNotificationActions = (userId: number) => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const t = useTranslations("core.global.notifications");
  const tErrors = useTranslations("core.global.errors");

  return React.useMemo(() => {
    const apply = (state: NotificationState) =>
      notificationStateStore.apply(userId, state);

    const recover = async () => {
      toast.error(tErrors("title"), { description: t("action_failed") });
      const latest = await fetchNotificationState().catch(() => null);
      if (latest) apply(latest);
      await invalidateNotificationLists(queryClient, userId);
    };

    const run = async (
      action: () => Promise<NotificationState>,
      optimistic: () => void,
    ): Promise<boolean> => {
      optimistic();
      try {
        apply(await action());

        return true;
      } catch {
        await recover();

        return false;
      }
    };

    return {
      archive: async (item: NotificationItemView) => {
        const ok = await run(
          async () => await archiveNotificationInBrowser({ id: item.id }),
          () => patchCachedNotification(queryClient, userId, item.id, null),
        );
        if (ok) toast.success(t("archived"), { description: item.title });
      },
      markAllRead: async () => {
        const ok = await run(
          async () => await markAllNotificationsReadInBrowser(),
          () => markAllCachedRead(queryClient, userId),
        );
        if (ok)
          toast.success(t("all_read"), { description: t("all_read_desc") });
      },
      open: (item: NotificationItemView, { newTab }: { newTab: boolean }) => {
        if (item.unread) {
          void run(
            async () =>
              await markNotificationReadInBrowser({
                id: item.id,
                throughSeq: item.activitySeq,
              }),
            () =>
              patchCachedNotification(queryClient, userId, item.id, {
                unread: false,
              }),
          );
        }

        if (!newTab && item.available && item.target) {
          void router.navigate({ href: item.target });
        }
      },
      toggleRead: async (item: NotificationItemView) => {
        await run(
          async () =>
            item.unread
              ? await markNotificationReadInBrowser({
                  id: item.id,
                  throughSeq: item.activitySeq,
                })
              : await markNotificationUnreadInBrowser({ id: item.id }),
          () =>
            patchCachedNotification(queryClient, userId, item.id, {
              unread: !item.unread,
            }),
        );
      },
    };
  }, [queryClient, router, t, tErrors, userId]);
};
