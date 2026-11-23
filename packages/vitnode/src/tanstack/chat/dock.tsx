import { useRouterState } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Maximize2Icon, MinusIcon, SquarePenIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";

import type { ChatSessionUser } from "./chat-view";

import { ChatList, ChatListSkeleton } from "./chat-list";
import { ChatView } from "./chat-view";
import { setChatDock, useChatDock } from "./dock-store";
import { NewChat } from "./new-chat";

const DockPanel = ({ me }: { me: ChatSessionUser }) => {
  const t = useTranslations("core.global.chat.dock");
  const dock = useChatDock();
  const titleId = React.useId();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const toList = () => {
    setChatDock({ view: { type: "list" } });
  };
  const fullHref =
    dock.view.type === "chat"
      ? `/chat/${dock.view.chatId}`
      : dock.view.type === "new"
        ? "/chat/new"
        : "/chat";

  React.useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="false"
      className="bg-background fixed end-4 bottom-0 z-40 flex h-150 max-h-4/5 w-100 flex-col overflow-hidden rounded-t-xl border shadow-2xl transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none starting:translate-y-4 starting:opacity-0"
      onKeyDown={event => {
        if (event.key === "Escape" && !event.defaultPrevented) {
          setChatDock({ open: false });
        }
      }}
      ref={panelRef}
      role="dialog"
      tabIndex={-1}
    >
      <div className="flex items-center gap-1 border-b px-3 py-1.5">
        <h2 className="flex-1 text-sm font-semibold" id={titleId}>
          {t("title")}
        </h2>
        <Button
          aria-label={t("new")}
          onClick={() => {
            setChatDock({ view: { people: [], type: "new" } });
          }}
          size="icon-sm"
          title={t("new")}
          variant="ghost"
        >
          <SquarePenIcon aria-hidden="true" />
        </Button>
        <Button
          aria-label={t("full_screen")}
          nativeButton={false}
          onClick={() => {
            setChatDock({ open: false });
          }}
          render={<Link to={fullHref} />}
          size="icon-sm"
          title={t("full_screen")}
          variant="ghost"
        >
          <Maximize2Icon aria-hidden="true" />
        </Button>
        <Button
          aria-label={t("minimize")}
          onClick={() => {
            setChatDock({ open: false });
          }}
          size="icon-sm"
          title={t("minimize")}
          variant="ghost"
        >
          <MinusIcon aria-hidden="true" />
        </Button>
      </div>
      {dock.view.type === "chat" ? (
        <ChatView
          chatId={dock.view.chatId}
          key={dock.view.chatId}
          me={me}
          onBack={toList}
          onLeft={toList}
        />
      ) : dock.view.type === "new" ? (
        <NewChat
          initialPeople={dock.view.people}
          key={dock.view.people.map(person => person.id).join(",")}
          me={me}
          onBack={toList}
          onCreated={chatId => {
            setChatDock({ view: { chatId, type: "chat" } });
          }}
        />
      ) : (
        <ChatList
          filter={dock.filter}
          onFilterChange={filter => {
            setChatDock({ filter });
          }}
          onSelect={chatId => {
            setChatDock({ view: { chatId, type: "chat" } });
          }}
          userId={me.id}
        />
      )}
    </div>
  );
};

/**
 * The chat window docked in the corner on wide screens. It stays mounted
 * across page navigation (so a half-written message survives) and hides on
 * the `/chat` pages, which show the same thing full size.
 */
export const ChatDock = ({ me }: { me: ChatSessionUser }) => {
  const dock = useChatDock();
  const onChatPage = useRouterState({
    select: state =>
      state.location.pathname === "/chat" ||
      state.location.pathname.startsWith("/chat/"),
  });
  const [mounted, setMounted] = React.useState(dock.open);
  if (dock.open && !mounted) setMounted(true);
  if (!mounted || onChatPage) return null;

  return (
    <React.Activity mode={dock.open ? "visible" : "hidden"}>
      <React.Suspense fallback={<ChatListSkeleton />}>
        <DockPanel me={me} />
      </React.Suspense>
    </React.Activity>
  );
};
