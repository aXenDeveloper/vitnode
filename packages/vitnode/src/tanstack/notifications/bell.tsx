import { useQuery } from "@tanstack/react-query";
import React from "react";

import type { NotificationState } from "@/lib/notifications/types";

import { useNotificationState } from "@/views/notifications/notification-state-store";
import { NotificationsBellContent } from "@/views/notifications/notifications-bell-content";
import { recentNotificationsQueryOptions } from "@/views/notifications/notifications-query";

import { useSessionQuery } from "../auth/session-query";
import { useNotificationActions } from "./actions";

const SignedInBell = ({
  sessionState,
  userId,
}: {
  sessionState: NotificationState;
  userId: number;
}) => {
  const [open, setOpen] = React.useState(false);
  const state = useNotificationState(userId);
  const actions = useNotificationActions(userId);
  // Fetched only while open: the bell's number never needs the list.
  const recent = useQuery({
    ...recentNotificationsQueryOptions({ userId }),
    enabled: open,
  });

  return (
    <NotificationsBellContent
      onMarkAllRead={() => void actions.markAllRead()}
      onOpenChange={setOpen}
      onOpenItem={(item, options) => {
        actions.open(item, options);
        if (!options.newTab) setOpen(false);
      }}
      onRetry={() => void recent.refetch()}
      open={open}
      recent={{
        isError: recent.isError,
        isPending: recent.isPending,
        items: recent.data?.items,
      }}
      unread={(state ?? sessionState).unread}
    />
  );
};

/** The header bell for the signed-in user; nothing for guests. */
export const NotificationsBell = () => {
  const { data: session } = useSessionQuery();
  const user = session?.user;
  if (!user) return null;

  return (
    <SignedInBell
      key={user.id}
      sessionState={user.notifications}
      userId={user.id}
    />
  );
};
