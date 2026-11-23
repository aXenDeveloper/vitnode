import type { ChatListItem } from "@vitnode/api/lib/chat/types";

import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import {
  BellOffIcon,
  MessageCircleIcon,
  MessageCircleOffIcon,
  RotateCwIcon,
} from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { ChatListFilter } from "./query";

import { ChatAvatar, chatDisplayName } from "./chat-avatar";
import { chatListQueryOptions, chatStateQueryOptions } from "./query";
import { useSystemLine } from "./system-line";

const subscribeToNothing = () => () => {};

const ROW_CLASS =
  "hover:bg-muted focus-visible:ring-ring/50 flex w-full min-w-0 items-center gap-3 rounded-lg p-2 text-start outline-none focus-visible:ring-3";

/** Row-shaped placeholders for the chat list. */
export const ChatListSkeleton = ({ rows = 6 }: { rows?: number }) => {
  const t = useTranslations("core.global.chat");

  return (
    <div aria-busy="true" className="flex flex-col gap-1 p-2" role="status">
      <span className="sr-only">{t("loading")}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div className="flex items-center gap-3 p-2" key={index}>
          <Skeleton className="size-10 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
};

const Row = ({
  active,
  item,
  onSelect,
  userId,
}: {
  active: boolean;
  item: ChatListItem;
  onSelect?: (chatId: number) => void;
  userId: number;
}) => {
  const t = useTranslations("core.global.chat");
  const names = React.useMemo(
    () =>
      new Map(
        item.lastMessage?.authorId && item.lastMessage.authorName
          ? [[item.lastMessage.authorId, item.lastMessage.authorName]]
          : [],
      ),
    [item.lastMessage],
  );
  const systemLine = useSystemLine(names);
  const name = chatDisplayName(item);
  const last = item.lastMessage;
  let preview: string;
  if (item.status === "pending" && item.kind === "group") {
    preview = t("list.group_invite", { name: item.invitedBy?.name ?? "" });
  } else if (!last) {
    preview = t("list.no_messages");
  } else if (last.system) {
    preview = systemLine(last.system, last.authorId);
  } else if (last.preview === null) {
    preview = t("message.deleted");
  } else {
    preview =
      last.authorId === userId
        ? t("list.you", { text: last.preview })
        : last.preview;
  }
  const content = (
    <>
      <ChatAvatar kind={item.kind} members={item.members} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "truncate text-sm",
              item.unread ? "font-semibold" : "font-medium",
            )}
          >
            {name}
          </span>
          {item.muted ? (
            <BellOffIcon
              aria-label={t("list.muted")}
              className="text-muted-foreground size-3.5 shrink-0"
            />
          ) : null}
          {last ? (
            <span className="text-muted-foreground ms-auto shrink-0 text-xs">
              <DateFormat
                date={
                  // A server clock a second ahead must not read "in 1 second".
                  // oxlint-disable-next-line react/purity
                  new Date(Math.min(Date.parse(last.createdAt), Date.now()))
                }
              />
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            "truncate text-sm",
            item.unread ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {preview}
        </span>
      </span>
      {item.unread ? (
        <span className="bg-primary size-2.5 shrink-0 rounded-full">
          <span className="sr-only">{t("list.unread")}</span>
        </span>
      ) : null}
    </>
  );

  return (
    <li>
      {onSelect ? (
        <button
          aria-current={active ? "true" : undefined}
          className={cn(ROW_CLASS, active && "bg-muted")}
          onClick={() => {
            onSelect(item.id);
          }}
          type="button"
        >
          {content}
        </button>
      ) : (
        <Link
          aria-current={active ? "page" : undefined}
          className={cn(ROW_CLASS, active && "bg-muted")}
          to={`/chat/${item.id}`}
        >
          {content}
        </Link>
      )}
    </li>
  );
};

/**
 * The member's chats with All / Unread / Requests tabs. In the dock rows call
 * `onSelect`; on the page they link to `/chat/{id}`.
 */
export const ChatList = ({
  activeChatId,
  filter,
  onFilterChange,
  onSelect,
  userId,
}: {
  activeChatId?: number;
  filter: ChatListFilter;
  onFilterChange: (filter: ChatListFilter) => void;
  onSelect?: (chatId: number) => void;
  userId: number;
}) => {
  const t = useTranslations("core.global.chat");
  const state = useQuery(chatStateQueryOptions(userId));
  const query = useInfiniteQuery({
    ...chatListQueryOptions({ filter, userId }),
    placeholderData: keepPreviousData,
  });
  const items = query.data?.pages.flatMap(page => page.items) ?? [];
  // The count comes from the browser's cache, which the server never saw:
  // show it only after hydration so both render the same markup.
  const hydrated = React.useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  const requests = hydrated ? (state.data?.requests ?? 0) : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Tabs
        className="px-2 pt-2"
        onValueChange={value => {
          onFilterChange(value as ChatListFilter);
        }}
        value={filter}
      >
        <TabsList className="w-full">
          <TabsTrigger value="all">{t("list.all")}</TabsTrigger>
          <TabsTrigger value="unread">{t("list.unread_tab")}</TabsTrigger>
          <TabsTrigger value="requests">
            {t("list.requests")}
            {requests > 0 ? (
              <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-xs tabular-nums">
                {requests > 99 ? "99+" : requests}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div
        aria-busy={query.isFetching}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          query.isPlaceholderData && "opacity-60",
        )}
      >
        {query.isPending ? (
          <ChatListSkeleton />
        ) : query.isError && items.length === 0 ? (
          <Empty className="p-6" role="alert">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageCircleOffIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t("list.load_error.title")}</EmptyTitle>
              <EmptyDescription>{t("list.load_error.desc")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                isLoading={query.isFetching}
                onClick={() => void query.refetch()}
                size="sm"
                variant="outline"
              >
                <RotateCwIcon aria-hidden="true" />
                {t("retry")}
              </Button>
            </EmptyContent>
          </Empty>
        ) : items.length === 0 ? (
          <Empty className="p-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageCircleIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t(`list.empty.${filter}.title`)}</EmptyTitle>
              <EmptyDescription>
                {t(`list.empty.${filter}.desc`)}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul
            aria-label={t("list.label")}
            className="flex flex-col gap-0.5 p-2"
          >
            {items.map(item => (
              <Row
                active={item.id === activeChatId}
                item={item}
                key={item.id}
                onSelect={onSelect}
                userId={userId}
              />
            ))}
          </ul>
        )}
        {query.hasNextPage ? (
          <div className="flex justify-center p-2">
            <Button
              isLoading={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
              size="sm"
              variant="ghost"
            >
              {t("list.load_more")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
