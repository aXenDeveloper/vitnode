import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { MessageCircleIcon, Settings2Icon, SquarePenIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import type { ChatListFilter } from "./query";

import { ChatList } from "./chat-list";
import { ChatView, useChatSessionUser } from "./chat-view";
import { useChatDock } from "./dock-store";
import { NewChat } from "./new-chat";

export const CHAT_NAMESPACES = ["core.global"] as const;

export interface ChatRouteSearch {
  filter?: ChatListFilter;
}

export const normalizeChatRouteSearch = (
  search: Record<string, unknown>,
): ChatRouteSearch =>
  search.filter === "unread" || search.filter === "requests"
    ? { filter: search.filter }
    : {};

const activeChatIdOf = (pathname: string): number | undefined => {
  const match = /^\/chat\/(\d+)$/u.exec(pathname);

  return match ? Number(match[1]) : undefined;
};

/**
 * The `/chat` pages' frame: the chat list beside the open chat on wide
 * screens, one of them at a time on phones.
 */
export const ChatLayoutContent = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const t = useTranslations("core.global.chat");
  const me = useChatSessionUser();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: state => state.location.pathname });
  const search = useRouterState({
    select: state => state.location.search as ChatRouteSearch,
  });
  const activeChatId = activeChatIdOf(pathname);
  const onIndex = pathname === "/chat" || pathname === "/chat/";
  if (!me) return null;

  return (
    <main className="container mx-auto flex flex-col gap-4 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-balance">{t("title")}</h1>
        <div className="flex items-center gap-1">
          <Button
            aria-label={t("settings_link")}
            nativeButton={false}
            render={<Link to="/settings/chat" />}
            size="icon"
            title={t("settings_link")}
            variant="ghost"
          >
            <Settings2Icon aria-hidden="true" />
          </Button>
          <Button nativeButton={false} render={<Link to="/chat/new" />}>
            <SquarePenIcon aria-hidden="true" />
            {t("new_chat")}
          </Button>
        </div>
      </div>
      <div className="bg-card flex h-[calc(100dvh-17rem)] min-h-96 overflow-hidden rounded-xl border md:h-[calc(100dvh-12rem)]">
        <aside
          aria-label={t("list.label")}
          className={cn(
            "flex min-h-0 w-full flex-col border-e md:w-80 md:shrink-0",
            !onIndex && "max-md:hidden",
          )}
        >
          <ChatList
            activeChatId={activeChatId}
            filter={search.filter ?? "all"}
            onFilterChange={filter => {
              void navigate({
                search: { filter: filter === "all" ? undefined : filter },
                to: "/chat",
              });
            }}
            userId={me.id}
          />
        </aside>
        <section
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col",
            onIndex && "max-md:hidden",
          )}
        >
          {children}
        </section>
      </div>
    </main>
  );
};

/** The right pane of `/chat` before a chat is picked. */
export const ChatIndexContent = () => {
  const t = useTranslations("core.global.chat.pick");

  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessageCircleIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{t("title")}</EmptyTitle>
        <EmptyDescription>{t("desc")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button nativeButton={false} render={<Link to="/chat/new" />}>
          <SquarePenIcon aria-hidden="true" />
          {t("new")}
        </Button>
      </EmptyContent>
    </Empty>
  );
};

/** `/chat/{id}`. */
export const ChatPageContent = ({ chatId }: { chatId: number }) => {
  const me = useChatSessionUser();
  const navigate = useNavigate();
  if (!me) return null;

  return (
    <ChatView
      chatId={chatId}
      key={chatId}
      me={me}
      onLeft={() => {
        void navigate({ to: "/chat" });
      }}
    />
  );
};

/** `/chat/new`. */
export const NewChatPageContent = () => {
  const me = useChatSessionUser();
  const navigate = useNavigate();
  const dock = useChatDock();
  if (!me) return null;

  return (
    <NewChat
      initialPeople={dock.view.type === "new" ? dock.view.people : []}
      me={me}
      onCreated={chatId => {
        void navigate({ to: `/chat/${chatId}` });
      }}
    />
  );
};
