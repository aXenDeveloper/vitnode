import type {
  NotificationState,
  NotificationSubject,
} from "@/lib/notifications/types";

import { CONFIG_PLUGIN } from "@/config";
import { fetcherClient } from "@/lib/fetcher-client";

import { NotificationsRequestError } from "./notifications-query";

const failed = (response: { status: number }): never => {
  throw new NotificationsRequestError(response.status);
};

/** Marks one item read through the activity the user saw. */
export const markNotificationReadInBrowser = async ({
  id,
  throughSeq,
}: {
  id: number;
  throughSeq?: number;
}): Promise<NotificationState> => {
  const response = await fetcherClient({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { body: { throughSeq }, params: { id } },
    method: "post",
    module: "notifications",
    options: { credentials: "include" },
    path: "/{id}/read",
  });

  return response.ok ? await response.json() : failed(response);
};

export const markNotificationUnreadInBrowser = async ({
  id,
}: {
  id: number;
}): Promise<NotificationState> => {
  const response = await fetcherClient({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { params: { id } },
    method: "post",
    module: "notifications",
    options: { credentials: "include" },
    path: "/{id}/unread",
  });

  return response.ok ? await response.json() : failed(response);
};

export const archiveNotificationInBrowser = async ({
  id,
}: {
  id: number;
}): Promise<NotificationState> => {
  const response = await fetcherClient({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { params: { id } },
    method: "post",
    module: "notifications",
    options: { credentials: "include" },
    path: "/{id}/archive",
  });

  return response.ok ? await response.json() : failed(response);
};

export const markAllNotificationsReadInBrowser = async ({
  category,
}: {
  category?: string;
} = {}): Promise<NotificationState & { marked: number }> => {
  const response = await fetcherClient({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { body: { category } },
    method: "post",
    module: "notifications",
    options: { credentials: "include" },
    path: "/read-all",
  });

  return response.ok ? await response.json() : failed(response);
};

export interface UpdateNotificationPreferencesBody {
  digestHour?: number;
  digestWeekday?: number;
  timeZone?: null | string;
  types?: Record<
    string,
    { email?: "daily" | "immediate" | "none" | "weekly"; inApp?: boolean }
  >;
}

export const updateNotificationPreferencesInBrowser = async (
  body: UpdateNotificationPreferencesBody,
): Promise<void> => {
  const response = await fetcherClient({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { body },
    method: "put",
    module: "notifications",
    options: { credentials: "include" },
    path: "/preferences",
  });
  if (!response.ok) failed(response);
};

export type NotificationSubscriptionState = "following" | "muted" | "none";

export const setNotificationSubscriptionInBrowser = async ({
  state,
  subject,
}: {
  state: NotificationSubscriptionState;
  subject: NotificationSubject;
}): Promise<NotificationSubscriptionState> => {
  const response = await fetcherClient({
    plugin: CONFIG_PLUGIN.pluginId,
    args: {
      body: {
        state,
        subjectId: String(subject.id),
        subjectType: subject.type,
      },
    },
    method: "put",
    module: "notifications",
    options: { credentials: "include" },
    path: "/subscriptions",
  });

  return response.ok ? (await response.json()).state : failed(response);
};
