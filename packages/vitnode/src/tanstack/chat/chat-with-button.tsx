import type { ContentPublicPerson } from "@vitnode/api/content/public-person";

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { MessageCircleIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";

import { useChatSessionUser } from "./chat-view";
import { openChatDock, setChatDock, useDockAvailable } from "./dock-store";
import { canChatQueryOptions, chatStateQueryOptions } from "./query";

/**
 * "Chat" (or "Send chat request") for one member: opens the chat with them,
 * in the dock on wide screens. Nothing for guests, yourself, or when they
 * can't be messaged.
 */
export const ChatWithButton = ({
  className,
  person,
  size = "sm",
}: {
  className?: string;
  person: ContentPublicPerson;
  size?: "default" | "lg" | "sm" | "xs";
}) => {
  const t = useTranslations("core.global.chat.button");
  const me = useChatSessionUser();
  const navigate = useNavigate();
  const dockAvailable = useDockAvailable();
  const isOther = !!me && me.id !== person.id;
  const state = useQuery({
    ...chatStateQueryOptions(me?.id ?? 0),
    enabled: isOther,
  });
  const canChat = useQuery({
    ...canChatQueryOptions({ targetId: person.id, userId: me?.id ?? 0 }),
    enabled: isOther && !!state.data?.enabled,
  });
  if (!isOther || !state.data?.enabled || !canChat.data) return null;
  const { allowed, asRequest, chatId } = canChat.data;
  if (!allowed && chatId === null) return null;

  const open = () => {
    if (chatId !== null) {
      if (dockAvailable) {
        openChatDock({ chatId, type: "chat" });
      } else {
        void navigate({ to: `/chat/${chatId}` });
      }

      return;
    }
    if (dockAvailable) {
      openChatDock({ people: [person], type: "new" });
    } else {
      setChatDock({ view: { people: [person], type: "new" } });
      void navigate({ to: "/chat/new" });
    }
  };

  return (
    <Button className={className} onClick={open} size={size} variant="outline">
      <MessageCircleIcon aria-hidden="true" />
      {asRequest ? t("send_request") : t("chat")}
    </Button>
  );
};
