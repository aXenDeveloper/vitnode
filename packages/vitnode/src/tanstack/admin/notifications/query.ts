import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import type { NotificationsAdminActions } from "@/views/admin/views/core/system/notifications/notifications-mutations";

import { notificationsAdminActionsInBrowser } from "@/views/admin/views/core/system/notifications/notifications-mutations";
import { notificationsAdminQueryRoot } from "@/views/admin/views/core/system/notifications/notifications-query";

export const invalidateNotificationsAdmin = async (
  queryClient: QueryClient,
): Promise<void> =>
  await queryClient.invalidateQueries({
    queryKey: notificationsAdminQueryRoot,
  });

export const useNotificationsAdminActions = (): NotificationsAdminActions => {
  const queryClient = useQueryClient();

  return React.useMemo<NotificationsAdminActions>(() => {
    const refreshOnSuccess =
      <Args extends unknown[], Result extends { error?: string }>(
        action: (...args: Args) => Promise<Result>,
      ) =>
      async (...args: Args): Promise<Result> => {
        const result = await action(...args);
        if (result.error === undefined) {
          await invalidateNotificationsAdmin(queryClient);
        }

        return result;
      };

    const browser = notificationsAdminActionsInBrowser;

    return {
      cancelQueuedEmails: refreshOnSuccess(browser.cancelQueuedEmails),
      deleteAll: refreshOnSuccess(browser.deleteAll),
      markEverythingRead: refreshOnSuccess(browser.markEverythingRead),
      pause: refreshOnSuccess(browser.pause),
      resetMemberPreferences: refreshOnSuccess(browser.resetMemberPreferences),
      resume: refreshOnSuccess(browser.resume),
      sendTestEmail: refreshOnSuccess(browser.sendTestEmail),
      updateTypePolicy: refreshOnSuccess(browser.updateTypePolicy),
    };
  }, [queryClient]);
};
