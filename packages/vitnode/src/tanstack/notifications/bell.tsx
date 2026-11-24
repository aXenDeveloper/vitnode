import type { NotificationState } from "@vitnode/api/lib/notifications/types";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { useTranslations } from "use-intl";

import type { NotificationItemProps } from "@/views/notifications/notification-item";
import type { NotificationsFeedFilter } from "@/views/notifications/notifications-query";

import { useNotificationState } from "@/views/notifications/notification-state-store";
import { NotificationsBellContent } from "@/views/notifications/notifications-bell-content";
import { NotificationsFeed } from "@/views/notifications/notifications-feed";
import { notificationsFeedQueryOptions } from "@/views/notifications/notifications-query";

import { useSessionQuery } from "../auth/session-query";
import { useNotificationActions } from "./actions";

const BellFeed = ({
  filter,
  userId,
  ...itemActions
}: Omit<NotificationItemProps, "item"> & {
  filter: NotificationsFeedFilter;
  userId: number;
}) => {
  const t = useTranslations("core.global.notifications");
  const feed = useInfiniteQuery(
    notificationsFeedQueryOptions({ filter, userId }),
  );
  const items = React.useMemo(
    () => feed.data?.pages.flatMap(page => page.items) ?? [],
    [feed.data],
  );
  const { fetchNextPage, refetch } = feed;

  return (
    <NotificationsFeed
      className="h-full"
      feed={{
        fetchNextPage: () => void fetchNextPage(),
        hasNextPage: feed.hasNextPage,
        isError: feed.isError,
        isFetching: feed.isFetching,
        isFetchingNextPage: feed.isFetchingNextPage,
        isFetchNextPageError: feed.isFetchNextPageError,
        isPending: feed.isPending,
        items,
        refetch: () => void refetch(),
      }}
      filter={filter}
      label={t(`filter.${filter}`)}
      {...itemActions}
    />
  );
};

const SignedInBell = ({
  sessionState,
  userId,
}: {
  sessionState: NotificationState;
  userId: number;
}) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<NotificationsFeedFilter>("unread");
  const state = useNotificationState(userId);
  const actions = useNotificationActions(userId);

  return (
    <NotificationsBellContent
      filter={filter}
      onFilterChange={setFilter}
      onMarkAllRead={async () => {
        await actions.markAllRead();
        await queryClient.refetchQueries({
          queryKey: notificationsFeedQueryOptions({ filter: "unread", userId })
            .queryKey,
        });
      }}
      onOpenChange={setOpen}
      open={open}
      renderFeed={feedFilter => (
        <BellFeed
          filter={feedFilter}
          onArchive={item => void actions.archive(item)}
          onOpen={(item, options) => {
            actions.open(item, options);
            if (!options.newTab) setOpen(false);
          }}
          onToggleRead={item => void actions.toggleRead(item)}
          userId={userId}
        />
      )}
      unread={(state ?? sessionState).unread}
    />
  );
};

/** The header's notifications bell and popover. Renders nothing for guests. */
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
