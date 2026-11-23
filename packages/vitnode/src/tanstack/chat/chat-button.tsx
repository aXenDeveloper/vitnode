import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MessageCircleIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";

import { useChatSessionUser } from "./chat-view";
import { setChatDock, useChatDock, useDockAvailable } from "./dock-store";
import { chatStateQueryOptions } from "./query";

/**
 * The header's Chat button: unread chats as a number, new requests as a dot.
 * On wide screens it toggles the chat dock; on small ones it opens `/chat`.
 * Renders nothing for guests or when chat is off for the member.
 */
export const ChatButton = () => {
  const t = useTranslations("core.global.chat.button");
  const me = useChatSessionUser();
  const dock = useChatDock();
  const dockAvailable = useDockAvailable();
  const state = useQuery({
    ...chatStateQueryOptions(me?.id ?? 0),
    enabled: !!me,
  });
  if (!me || !state.data?.enabled) return null;

  const unread = state.data.unreadChats;
  const requests = state.data.requests;
  const label =
    unread > 0
      ? t("label_unread", { count: unread })
      : requests > 0
        ? t("label_requests", { count: requests })
        : t("label");
  const badge = unread > 99 ? "99+" : String(unread);
  const indicator =
    unread > 0 ? (
      <span
        aria-hidden="true"
        className="bg-destructive absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-xs leading-none font-semibold text-white tabular-nums"
      >
        {badge}
      </span>
    ) : requests > 0 ? (
      <span
        aria-hidden="true"
        className="bg-primary ring-background absolute end-1 top-1 size-2.5 rounded-full ring-2"
      />
    ) : null;

  if (!dockAvailable) {
    return (
      <Button
        aria-label={label}
        className="relative"
        nativeButton={false}
        render={<Link to="/chat" />}
        size="icon"
        title={label}
        variant="ghost"
      >
        <MessageCircleIcon aria-hidden="true" />
        {indicator}
      </Button>
    );
  }

  return (
    <Button
      aria-expanded={dock.open}
      aria-label={label}
      className="relative"
      onClick={() => {
        setChatDock(previous => ({ ...previous, open: !previous.open }));
      }}
      size="icon"
      title={label}
      variant="ghost"
    >
      <MessageCircleIcon aria-hidden="true" />
      {indicator}
    </Button>
  );
};
