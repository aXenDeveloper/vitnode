import type { ContentPublicPerson } from "@vitnode/api/content/public-person";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CHAT_LIMITS } from "@vitnode/api/lib/chat/const";
import { ArrowLeftIcon, SendHorizontalIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { ChatSessionUser } from "./chat-view";

import { useChatErrorToast } from "./composer";
import { ChatPeoplePicker } from "./people-picker";
import {
  canChatQueryOptions,
  chatStateQueryOptions,
  invalidateChatOverview,
  startChatRequest,
} from "./query";

/**
 * Starts a chat: pick people, name the group when there are several, write
 * the first message. Opens the existing chat when there is one.
 */
export const NewChat = ({
  initialPeople = [],
  me,
  onBack,
  onCreated,
}: {
  initialPeople?: ContentPublicPerson[];
  me: ChatSessionUser;
  onBack?: () => void;
  onCreated: (chatId: number) => void;
}) => {
  const t = useTranslations("core.global.chat.new");
  const queryClient = useQueryClient();
  const showError = useChatErrorToast();
  const titleId = React.useId();
  const bodyId = React.useId();
  const [people, setPeople] = React.useState(initialPeople);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const single = people.length === 1 ? people[0] : undefined;
  const canChat = useQuery({
    ...canChatQueryOptions({ targetId: single?.id ?? 0, userId: me.id }),
    enabled: !!single,
  });
  const state = useQuery(chatStateQueryOptions(me.id));
  const groups = state.data?.groups ?? true;
  const isGroup = people.length > 1;
  const trimmed = body.trim();
  const blocked = !!single && canChat.data?.allowed === false;
  const ready =
    people.length > 0 &&
    !blocked &&
    (isGroup || trimmed.length > 0) &&
    body.length <= CHAT_LIMITS.messageMaxLength;

  const submit = async () => {
    if (!ready) return;
    setIsSaving(true);
    try {
      const result = await startChatRequest({
        body: trimmed || undefined,
        title: isGroup ? title.trim() || undefined : undefined,
        userIds: people.map(person => person.id),
      });
      await invalidateChatOverview(queryClient, me.id, result.chatId);
      if (single && canChat.data?.asRequest) {
        toast.success(t("request_sent"), {
          description: t("request_sent_desc", { name: single.name }),
        });
      }
      onCreated(result.chatId);
    } catch (error) {
      showError(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={event => {
        event.preventDefault();
        void submit();
      }}
    >
      <header className="flex items-center gap-2 border-b p-2">
        {onBack ? (
          <Button
            aria-label={t("back")}
            onClick={onBack}
            size="icon-sm"
            variant="ghost"
          >
            <ArrowLeftIcon aria-hidden="true" />
          </Button>
        ) : null}
        <h2 className="text-sm font-semibold text-balance">{t("title")}</h2>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
        <ChatPeoplePicker
          max={groups ? CHAT_LIMITS.maxGroupSize - 1 : 1}
          onChange={setPeople}
          userId={me.id}
          value={people}
        />
        {blocked ? (
          <p className="text-destructive text-sm" role="alert">
            {t("unavailable", { name: single.name })}
          </p>
        ) : single && canChat.data?.asRequest ? (
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {t("as_request", {
              count: CHAT_LIMITS.pendingMessages,
              name: single.name,
            })}
          </p>
        ) : null}
        {isGroup ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor={titleId}>{t("group_name")}</Label>
            <Input
              id={titleId}
              maxLength={CHAT_LIMITS.titleMaxLength}
              onChange={event => {
                setTitle(event.target.value);
              }}
              placeholder={t("group_name_placeholder")}
              value={title}
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor={bodyId}>
            {isGroup ? t("message_optional") : t("message")}
          </Label>
          <Textarea
            id={bodyId}
            maxLength={CHAT_LIMITS.messageMaxLength}
            onChange={event => {
              setBody(event.target.value);
            }}
            placeholder={t("message_placeholder")}
            rows={4}
            value={body}
          />
        </div>
      </div>
      <div className="flex justify-end border-t p-2">
        <Button disabled={!ready} isLoading={isSaving} type="submit">
          <SendHorizontalIcon aria-hidden="true" />
          {isGroup ? t("start_group") : t("send")}
        </Button>
      </div>
    </form>
  );
};
