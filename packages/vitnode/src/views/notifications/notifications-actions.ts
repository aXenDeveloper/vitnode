import type {
  NotificationEmailMode,
  NotificationState,
} from "@/lib/notifications/types";

import { fetcherClient } from "@/lib/fetcher-client";
import { manifest } from "@/manifest";

import { NotificationsRequestError } from "./notifications-query";

const failed = (response: { status: number }): never => {
  throw new NotificationsRequestError(response.status);
};

export const markNotificationReadInBrowser = async ({
  id,
  throughSeq,
}: {
  id: number;
  throughSeq?: number;
}): Promise<NotificationState> => {
  const response = await fetcherClient({
    plugin: manifest.id,
    args: { body: { throughSeq }, params: { id } },
    method: "post",
    module: "notifications",
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
    plugin: manifest.id,
    args: { params: { id } },
    method: "post",
    module: "notifications",
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
    plugin: manifest.id,
    args: { params: { id } },
    method: "post",
    module: "notifications",
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
    plugin: manifest.id,
    args: { body: { category } },
    method: "post",
    module: "notifications",
    path: "/read-all",
  });

  return response.ok ? await response.json() : failed(response);
};

export interface UpdateNotificationPreferencesBody {
  types?: Record<
    string,
    {
      email?: NotificationEmailMode;
      inApp?: boolean;
      push?: boolean;
    }
  >;
}

export const updateNotificationPreferencesInBrowser = async (
  body: UpdateNotificationPreferencesBody,
): Promise<void> => {
  const response = await fetcherClient({
    plugin: manifest.id,
    args: { body },
    method: "put",
    module: "notifications",
    path: "/preferences",
  });
  if (!response.ok) failed(response);
};
