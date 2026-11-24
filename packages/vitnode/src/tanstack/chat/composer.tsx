import type { ChatMessage } from "@vitnode/api/lib/chat/types";

import { useQueryClient } from "@tanstack/react-query";
import { CHAT_LIMITS } from "@vitnode/api/lib/chat/const";
import {
  CheckIcon,
  PencilIcon,
  ReplyIcon,
  SendHorizontalIcon,
  XIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";

import type { ChatSessionUser } from "./chat-view";

import { useChatTypingSender } from "./live";
import {
  ChatRequestError,
  editChatMessageRequest,
  invalidateChatOverview,
  removeCachedMessage,
  sendChatMessageRequest,
  upsertCachedMessage,
} from "./query";

const draftKey = (chatId: number) => `vitnode-chat-draft:${chatId}`;

const readDraft = (chatId: number): string => {
  try {
    return localStorage.getItem(draftKey(chatId)) ?? "";
  } catch {
    return "";
  }
};

const writeDraft = (chatId: number, value: string) => {
  try {
    if (value) localStorage.setItem(draftKey(chatId), value);
    else localStorage.removeItem(draftKey(chatId));
  } catch {
    // Storage blocked: drafts just don't survive a reload.
  }
};

let optimisticId = -1;

const KNOWN_ERRORS = [
  "blocked",
  "daily_limit",
  "edit_window",
  "group_full",
  "groups_disabled",
  "not_allowed",
  "recipient_unavailable",
  "request_limit",
  "requests_paused",
  "too_many_invites",
  "too_many_reactions",
] as const;

/** Maps an API error code to the toast a member sees. */
export const useChatErrorToast = () => {
  const t = useTranslations("core.global.chat.errors");

  return React.useCallback(
    (error: unknown) => {
      const code = error instanceof ChatRequestError ? error.code : "unknown";
      const known = KNOWN_ERRORS.find(item => item === code);
      toast.error(t("title"), { description: t(known ?? "unknown") });
    },
    [t],
  );
};

/**
 * The message box under a chat. Enter sends and Shift+Enter starts a new
 * line (on touch screens Enter is a new line and the Send button sends).
 */
export const ChatComposer = ({
  chatId,
  disabled,
  editing,
  encryptText,
  me,
  onCancelEdit,
  onCancelReply,
  onSent,
  replyTo,
}: {
  chatId: number;
  disabled: boolean;
  editing: ChatMessage | null;
  /** Encrypted chats: turns text into the body and commitment to send. */
  encryptText?: (text: string) => Promise<{ body: string; commitment: string }>;
  me: ChatSessionUser;
  onCancelEdit: () => void;
  onCancelReply: () => void;
  onSent: () => void;
  replyTo: ChatMessage | null;
}) => {
  const t = useTranslations("core.global.chat.composer");
  const queryClient = useQueryClient();
  const coarse = useCoarsePointer();
  const showError = useChatErrorToast();
  const sendTyping = useChatTypingSender(chatId);
  const [value, setValue] = React.useState(() => readDraft(chatId));
  const [isSaving, setIsSaving] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const [editingSeen, setEditingSeen] = React.useState(editing);
  if (editing !== editingSeen) {
    setEditingSeen(editing);
    if (editing) setValue(editing.body ?? "");
  }

  React.useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  React.useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  const length = value.trim().length;
  const tooLong = value.length > CHAT_LIMITS.messageMaxLength;
  const showCounter = value.length >= CHAT_LIMITS.messageMaxLength * 0.9;

  const submit = async () => {
    const body = value.trim();
    if (!body || tooLong || disabled) return;

    if (editing) {
      setIsSaving(true);
      try {
        const sealed = encryptText ? await encryptText(body) : null;
        const updated = await editChatMessageRequest({
          body: sealed?.body ?? body,
          chatId,
          commitment: sealed?.commitment,
          messageId: editing.id,
        });
        upsertCachedMessage(queryClient, me.id, updated);
        setValue(readDraft(chatId));
        onCancelEdit();
      } catch (error) {
        showError(error);
      } finally {
        setIsSaving(false);
      }

      return;
    }

    const clientId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    const id = optimisticId--;
    upsertCachedMessage(queryClient, me.id, {
      author: me.person,
      body,
      chatId,
      clientId,
      createdAt: new Date().toISOString(),
      deleted: false,
      editedAt: null,
      encrypted: false,
      hidden: false,
      id,
      kind: "message",
      reactions: [],
      replyTo: replyTo
        ? {
            author: replyTo.author,
            deleted: false,
            encrypted: false,
            id: replyTo.id,
            text: replyTo.body,
          }
        : null,
      sentAsRequest: false,
      system: null,
    });
    setValue("");
    writeDraft(chatId, "");
    onCancelReply();
    onSent();
    try {
      const sealed = encryptText ? await encryptText(body) : null;
      const message = await sendChatMessageRequest({
        body: sealed?.body ?? body,
        chatId,
        clientId,
        commitment: sealed?.commitment,
        replyToMessageId: replyTo?.id,
      });
      upsertCachedMessage(queryClient, me.id, message);
      void invalidateChatOverview(queryClient, me.id, chatId);
    } catch (error) {
      removeCachedMessage(queryClient, me.id, chatId, id);
      setValue(body);
      showError(error);
    }
  };

  return (
    <form
      className="flex flex-col gap-2 border-t p-2"
      onSubmit={event => {
        event.preventDefault();
        void submit();
      }}
    >
      {editing || replyTo ? (
        <div className="bg-muted flex items-center gap-2 rounded-md px-2 py-1 text-sm">
          {editing ? (
            <PencilIcon aria-hidden="true" className="size-4 shrink-0" />
          ) : (
            <ReplyIcon aria-hidden="true" className="size-4 shrink-0" />
          )}
          <span className="min-w-0 flex-1 truncate">
            {editing
              ? t("editing")
              : t("replying_to", { name: replyTo?.author?.name ?? "" })}
            {replyTo && !editing ? (
              <span className="text-muted-foreground"> · {replyTo.body}</span>
            ) : null}
          </span>
          <Button
            aria-label={editing ? t("cancel_edit") : t("cancel_reply")}
            onClick={() => {
              if (editing) {
                onCancelEdit();
                setValue(readDraft(chatId));
              } else {
                onCancelReply();
              }
            }}
            size="icon-sm"
            variant="ghost"
          >
            <XIcon aria-hidden="true" />
          </Button>
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        <Textarea
          aria-describedby={showCounter ? `chat-counter-${chatId}` : undefined}
          aria-invalid={tooLong || undefined}
          aria-label={t("label")}
          className="max-h-40 min-h-10 flex-1 resize-none"
          disabled={disabled || isSaving}
          onChange={event => {
            setValue(event.target.value);
            if (!editing) writeDraft(chatId, event.target.value);
            if (event.target.value) sendTyping();
          }}
          onKeyDown={event => {
            if (event.key === "Escape" && editing) {
              onCancelEdit();
              setValue(readDraft(chatId));

              return;
            }
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !coarse &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder={disabled ? t("disabled") : t("placeholder")}
          ref={textareaRef}
          rows={1}
          value={value}
        />
        <Button
          aria-label={editing ? t("save") : t("send")}
          disabled={disabled || length === 0 || tooLong}
          isLoading={isSaving}
          size="icon"
          type="submit"
        >
          {editing ? (
            <CheckIcon aria-hidden="true" />
          ) : (
            <SendHorizontalIcon aria-hidden="true" />
          )}
        </Button>
      </div>
      {showCounter ? (
        <p
          className={
            tooLong
              ? "text-destructive px-1 text-xs"
              : "text-muted-foreground px-1 text-xs"
          }
          id={`chat-counter-${chatId}`}
        >
          {t("counter", {
            count: value.length,
            max: CHAT_LIMITS.messageMaxLength,
          })}
        </p>
      ) : null}
    </form>
  );
};
