import type { ChatMessage } from "@vitnode/api/lib/chat/types";

import { cn } from "cn";
import {
  CopyIcon,
  EllipsisIcon,
  FlagIcon,
  PencilIcon,
  ReplyIcon,
  SmilePlusIcon,
  Trash2Icon,
} from "lucide-react";
import React from "react";
import { useFormatter, useTranslations } from "use-intl";

import { Avatar } from "@/components/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from "@/components/ui/message";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { ChatMessageBody } from "./message-body";

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"] as const;

export interface ChatMessageActions {
  canEdit: (message: ChatMessage) => boolean;
  canReact: boolean;
  onDelete: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onJumpTo: (messageId: number) => void;
  onReact: (message: ChatMessage, emoji: string, add: boolean) => void;
  onReply: (message: ChatMessage) => void;
  onReport: (message: ChatMessage) => void;
}

const ReactionPicker = ({ onPick }: { onPick: (emoji: string) => void }) => {
  const t = useTranslations("core.global.chat.message");
  const [open, setOpen] = React.useState(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            aria-label={t("react")}
            className="text-muted-foreground"
            size="icon-sm"
            title={t("react")}
            variant="ghost"
          />
        }
      >
        <SmilePlusIcon aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="center" className="w-auto gap-2 p-2">
        <div className="flex gap-1">
          {QUICK_REACTIONS.map(emoji => (
            <Button
              aria-label={emoji}
              className="text-lg"
              key={emoji}
              onClick={() => {
                onPick(emoji);
                setOpen(false);
              }}
              size="icon-sm"
              variant="ghost"
            >
              {emoji}
            </Button>
          ))}
        </div>
        <EmojiPicker
          onSelect={emoji => {
            onPick(emoji);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
};

/**
 * One message as a bubble: yours on the end side in the primary color,
 * others' on the start side. Hovering or focusing it shows quick actions.
 */
export const ChatMessageItem = ({
  actions,
  grouped,
  isOwn,
  message,
  showAuthor,
  showTime,
}: {
  actions: ChatMessageActions;
  /** The previous message is by the same author a moment earlier. */
  grouped: boolean;
  isOwn: boolean;
  message: ChatMessage;
  /** Group chats name the author above their first message in a row. */
  showAuthor: boolean;
  /** The last message of a run shows its time. */
  showTime: boolean;
}) => {
  const t = useTranslations("core.global.chat.message");
  const format = useFormatter();
  const gone = message.deleted || message.hidden;
  const pending = message.id < 0;
  const time = format.dateTime(new Date(message.createdAt), {
    hour: "numeric",
    minute: "numeric",
  });

  return (
    <Message
      align={isOwn ? "end" : "start"}
      className={cn(grouped ? "mt-0.5" : "mt-3", pending && "opacity-70")}
      data-message-id={message.id}
      id={`chat-message-${message.id}`}
    >
      {isOwn ? null : (
        <MessageAvatar className={cn("size-8", grouped && "invisible")}>
          {message.author && !grouped ? (
            <Avatar alt="" size={32} user={message.author} />
          ) : null}
        </MessageAvatar>
      )}
      <MessageContent className="gap-1">
        {showAuthor && !isOwn && !grouped && message.author ? (
          <MessageHeader>{message.author.name}</MessageHeader>
        ) : null}

        {message.replyTo ? (
          <button
            className="text-muted-foreground border-border hover:text-foreground flex max-w-4/5 min-w-0 flex-col items-start rounded-md border-s-2 px-2 py-0.5 text-start text-xs group-data-[align=end]/message:self-end"
            onClick={() => {
              if (message.replyTo) actions.onJumpTo(message.replyTo.id);
            }}
            type="button"
          >
            <span className="font-medium">
              {t("reply_to", {
                name: message.replyTo.author?.name ?? t("deleted_member"),
              })}
            </span>
            <span className="max-w-full truncate">
              {message.replyTo.deleted
                ? t("original_deleted")
                : message.replyTo.text}
            </span>
          </button>
        ) : null}

        <div
          className="group/row flex items-center gap-1 outline-none group-data-[align=end]/message:flex-row-reverse"
          tabIndex={-1}
        >
          <Bubble
            align={isOwn ? "end" : "start"}
            className="max-w-full"
            variant={gone ? "outline" : isOwn ? "default" : "muted"}
          >
            <BubbleContent
              className={cn(gone && "text-muted-foreground italic")}
            >
              {message.hidden ? (
                t("hidden")
              ) : message.deleted ? (
                t("deleted")
              ) : (
                <ChatMessageBody
                  body={message.body ?? ""}
                  linksAsText={message.sentAsRequest && !isOwn}
                />
              )}
            </BubbleContent>
          </Bubble>

          {!gone && !pending ? (
            <div className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 motion-reduce:transition-none">
              {actions.canReact ? (
                <ReactionPicker
                  onPick={emoji => {
                    actions.onReact(
                      message,
                      emoji,
                      !message.reactions.some(
                        reaction =>
                          reaction.emoji === emoji && reaction.reacted,
                      ),
                    );
                  }}
                />
              ) : null}
              <Button
                aria-label={t("reply")}
                className="text-muted-foreground max-sm:hidden"
                onClick={() => {
                  actions.onReply(message);
                }}
                size="icon-sm"
                title={t("reply")}
                variant="ghost"
              >
                <ReplyIcon aria-hidden="true" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      aria-label={t("more")}
                      className="text-muted-foreground"
                      size="icon-sm"
                      variant="ghost"
                    />
                  }
                >
                  <EllipsisIcon aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="min-w-44">
                  <DropdownMenuItem
                    onClick={() => {
                      actions.onReply(message);
                    }}
                  >
                    <ReplyIcon aria-hidden="true" />
                    {t("reply")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      void navigator.clipboard.writeText(message.body ?? "");
                    }}
                  >
                    <CopyIcon aria-hidden="true" />
                    {t("copy")}
                  </DropdownMenuItem>
                  {isOwn && actions.canEdit(message) ? (
                    <DropdownMenuItem
                      onClick={() => {
                        actions.onEdit(message);
                      }}
                    >
                      <PencilIcon aria-hidden="true" />
                      {t("edit")}
                    </DropdownMenuItem>
                  ) : null}
                  {!isOwn ? (
                    <DropdownMenuItem
                      onClick={() => {
                        actions.onReport(message);
                      }}
                    >
                      <FlagIcon aria-hidden="true" />
                      {t("report")}
                    </DropdownMenuItem>
                  ) : null}
                  {isOwn ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          actions.onDelete(message);
                        }}
                        variant="destructive"
                      >
                        <Trash2Icon aria-hidden="true" />
                        {t("delete")}
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </div>

        {message.reactions.length > 0 ? (
          <ul
            aria-label={t("reactions")}
            className="flex flex-wrap gap-1 group-data-[align=end]/message:justify-end"
          >
            {message.reactions.map(reaction => (
              <li key={reaction.emoji}>
                <button
                  aria-label={t("reaction_label", {
                    count: reaction.count,
                    emoji: reaction.emoji,
                  })}
                  aria-pressed={reaction.reacted}
                  className={cn(
                    "border-border bg-background hover:bg-muted flex h-6 items-center gap-1 rounded-full border px-2 text-xs tabular-nums disabled:pointer-events-none",
                    reaction.reacted &&
                      "border-primary bg-primary/10 text-foreground",
                  )}
                  disabled={!actions.canReact}
                  onClick={() => {
                    actions.onReact(message, reaction.emoji, !reaction.reacted);
                  }}
                  type="button"
                >
                  <span aria-hidden="true">{reaction.emoji}</span>
                  <span aria-hidden="true">{reaction.count}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {showTime || pending || (message.editedAt && !gone) ? (
          <span className="text-muted-foreground px-1 text-xs group-data-[align=end]/message:self-end">
            <time dateTime={message.createdAt}>{time}</time>
            {message.editedAt && !gone ? ` · ${t("edited")}` : null}
            {pending ? ` · ${t("sending")}` : null}
          </span>
        ) : null}
      </MessageContent>
    </Message>
  );
};
