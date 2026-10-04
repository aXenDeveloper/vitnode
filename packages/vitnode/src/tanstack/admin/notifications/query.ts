import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import type { NotificationsAdminActions } from "@/views/admin/views/core/system/notifications/notifications-mutations";

import { notificationsAdminActionsInBrowser } from "@/views/admin/views/core/system/notifications/notifications-mutations";
import { notificationsAdminQueryRoot } from "@/views/admin/views/core/system/notifications/notifications-query";

/** Refreshes the overview and every cached activity range. */
export const invalidateNotificationsAdmin = async (
  queryClient: QueryClient,
): Promise<void> =>
  await queryClient.invalidateQueries({
    queryKey: notificationsAdminQueryRoot,
  });

/**
 * The screen's writes, each followed by a refresh of what it changed. A failed
 * write refreshes nothing - the cache still describes the server.
 */
export const useNotificationsAdminActions = (): NotificationsAdminActions => {
  const queryClient = useQueryClient();

  return React.useMemo<NotificationsAdminActions>(() => {
    const refreshing =
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
      cancelQueuedEmails: refreshing(browser.cancelQueuedEmails),
      cleanup: refreshing(browser.cleanup),
      deleteAll: refreshing(browser.deleteAll),
      markEverythingRead: refreshing(browser.markEverythingRead),
      pause: refreshing(browser.pause),
      resetMemberPreferences: refreshing(browser.resetMemberPreferences),
      resume: refreshing(browser.resume),
      sendTestEmail: refreshing(browser.sendTestEmail),
      updateSettings: refreshing(browser.updateSettings),
      updateTypePolicy: refreshing(browser.updateTypePolicy),
    };
  }, [queryClient]);
};
