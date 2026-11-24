import type { ContentPublicPerson } from "@vitnode/api/content/public-person";
import type { ChatDetails, ChatMessage } from "@vitnode/api/lib/chat/types";

import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { manifest } from "@vitnode/api/manifest";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  BanIcon,
  BellIcon,
  BellOffIcon,
  CheckIcon,
  EllipsisVerticalIcon,
  EyeOffIcon,
  FlagIcon,
  LockIcon,
  LogOutIcon,
  MessagesSquareIcon,
  PencilIcon,
  RotateCwIcon,
  Trash2Icon,
  UserPlusIcon,
  XIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { userProfileHref } from "@/components/user-profile-href";

import { useSessionQuery } from "../auth/session-query";
import { RouteMessages } from "../i18n/route-messages";
import { REPORT_NAMESPACES, ReportDialog } from "../moderation/report-button";
import { ChatAvatar, chatDisplayName } from "./chat-avatar";
import { ChatComposer, useChatErrorToast } from "./composer";
import { encryptChatMessage } from "./e2e/crypto";
import {
  peekDecrypted,
  useChatE2E,
  useChatKey,
  useChatKeyReshare,
  useDecryptedMessages,
} from "./e2e/hooks";
import { ChatUnlockPanel } from "./e2e/unlock-panel";
import { useChatTyping } from "./live";
import { type ChatMessageActions, ChatMessageItem } from "./message-item";
import {
  acceptChatRequest,
  chatDetailsQueryOptions,
  chatMessagesQueryOptions,
  deleteChatMessageRequest,
  discloseChatMessagesRequest,
  ignoreChatRequest,
  invalidateChatOverview,
  markChatReadRequest,
  patchCachedMessage,
  removeChatMemberRequest,
  setBlockRequest,
  setChatReactionRequest,
  updateChatRequest,
} from "./query";
import { useSystemLine } from "./system-line";

const LazyAddPeopleDialog = React.lazy(async () => ({
  default: (await import("./manage-dialogs")).AddPeopleDialog,
}));
const LazyRenameDialog = React.lazy(async () => ({
  default: (await import("./manage-dialogs")).RenameChatDialog,
}));

/** The signed-in member as chat needs them. */
export interface ChatSessionUser {
  id: number;
  person: ContentPublicPerson;
}

/** The signed-in member, or `null` for guests. */
export const useChatSessionUser = (): ChatSessionUser | null => {
  const { data } = useSessionQuery();
  const user = data?.user;

  return React.useMemo(
    () =>
      user
        ? {
            id: user.id,
            person: {
              avatarColor: user.avatarColor,
              avatarUrl: user.avatarUrl,
              id: user.id,
              name: user.name,
              nameCode: user.nameCode,
              role: { color: null, prefix: null },
            },
          }
        : null,
    [user],
  );
};

const GROUP_GAP_MS = 5 * 60 * 1000;
const NEAR_BOTTOM_PX = 120;

const sameRun = (a: ChatMessage | undefined, b: ChatMessage | undefined) =>
  !!a &&
  !!b &&
  a.kind === "message" &&
  b.kind === "message" &&
  a.author?.id === b.author?.id &&
  Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) <
    GROUP_GAP_MS;

const dayKey = (iso: string) => new Date(iso).toDateString();

const ChatViewSkeleton = () => {
  const t = useTranslations("core.global.chat");

  return (
    <div aria-busy="true" className="flex flex-1 flex-col" role="status">
      <span className="sr-only">{t("loading")}</span>
      <div className="flex items-center gap-3 border-b p-3">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex flex-1 flex-col justify-end gap-3 p-4">
        <Skeleton className="h-9 w-2/3 rounded-xl" />
        <Skeleton className="h-9 w-1/2 self-end rounded-xl" />
        <Skeleton className="h-14 w-3/5 rounded-xl" />
        <Skeleton className="h-9 w-1/3 self-end rounded-xl" />
      </div>
      <div className="border-t p-2">
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </div>
  );
};

const RequestBar = ({
  chat,
  onDone,
  userId,
}: {
  chat: ChatDetails;
  onDone?: () => void;
  userId: number;
}) => {
  const t = useTranslations("core.global.chat.request");
  const queryClient = useQueryClient();
  const showError = useChatErrorToast();
  const [busy, setBusy] = React.useState<null | string>(null);
  const [reporting, setReporting] = React.useState(false);
  const run = async (action: "accept" | "block" | "ignore") => {
    setBusy(action);
    try {
      if (action === "accept") {
        await acceptChatRequest(chat.id);
        toast.success(t("accepted"), { description: t("accepted_desc") });
      } else {
        await ignoreChatRequest({ block: action === "block", chatId: chat.id });
        toast.success(t(action === "block" ? "blocked" : "ignored"), {
          description: t(action === "block" ? "blocked_desc" : "ignored_desc"),
        });
        onDone?.();
      }
      await invalidateChatOverview(queryClient, userId, chat.id);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(null);
    }
  };
  const inviter = chat.me.invitedBy?.name ?? "";

  return (
    <section
      aria-label={t("label")}
      className="bg-muted/50 flex flex-col gap-3 border-b p-3"
    >
      <p className="text-sm leading-relaxed text-pretty">
        {chat.kind === "group"
          ? t("group_desc", {
              count: chat.membersCount,
              name: inviter,
              title: chat.title ?? "",
            })
          : t("direct_desc", { name: inviter })}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy !== null}
          isLoading={busy === "accept"}
          onClick={() => void run("accept")}
          size="sm"
        >
          <CheckIcon aria-hidden="true" />
          {t("accept")}
        </Button>
        <Button
          disabled={busy !== null}
          isLoading={busy === "ignore"}
          onClick={() => void run("ignore")}
          size="sm"
          variant="outline"
        >
          <XIcon aria-hidden="true" />
          {t("ignore")}
        </Button>
        <Button
          disabled={busy !== null}
          isLoading={busy === "block"}
          onClick={() => void run("block")}
          size="sm"
          variant="outline"
        >
          <BanIcon aria-hidden="true" />
          {t("block")}
        </Button>
        {chat.kind === "direct" && chat.lastMessageId ? (
          <Button
            disabled={busy !== null}
            onClick={() => {
              setReporting(true);
            }}
            size="sm"
            variant="ghost"
          >
            <FlagIcon aria-hidden="true" />
            {t("report")}
          </Button>
        ) : null}
      </div>
      {reporting && chat.lastMessageId ? (
        <React.Suspense fallback={null}>
          <RouteMessages namespaces={REPORT_NAMESPACES}>
            <ReportDialog
              onOpenChange={open => {
                if (!open) setReporting(false);
              }}
              open
              target={{
                id: String(chat.lastMessageId),
                pluginId: manifest.id,
                type: "chat.message",
              }}
              typeLabel={t("report_type")}
            />
          </RouteMessages>
        </React.Suspense>
      ) : null}
    </section>
  );
};

const muteOptions = [
  { hours: 8, key: "mute_8h" },
  { hours: 24 * 7, key: "mute_week" },
  { hours: 24 * 365 * 100, key: "mute_forever" },
] as const;

const ChatHeader = ({
  chat,
  chatKey,
  me,
  onBack,
  onLeft,
}: {
  chat: ChatDetails;
  chatKey: CryptoKey | null;
  me: ChatSessionUser;
  onBack?: () => void;
  onLeft?: () => void;
}) => {
  const t = useTranslations("core.global.chat.header");
  const queryClient = useQueryClient();
  const showError = useChatErrorToast();
  const [dialog, setDialog] = React.useState<
    "add" | "block" | "leave" | "rename" | null
  >(null);
  const others = chat.members
    .filter(member => member.user.id !== me.id)
    .map(member => member.user);
  const name = chatDisplayName({ members: others, title: chat.title });
  const other = chat.kind === "direct" ? others[0] : undefined;
  const muted = chat.me.mutedUntil !== null;

  const update = async (
    patch: Parameters<typeof updateChatRequest>[0],
    success?: { desc: string; title: string },
  ) => {
    try {
      await updateChatRequest(patch);
      if (success) toast.success(success.title, { description: success.desc });
      await invalidateChatOverview(queryClient, me.id, chat.id);
    } catch (error) {
      showError(error);
    }
  };

  return (
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
      ) : (
        <Button
          aria-label={t("back")}
          className="md:hidden"
          nativeButton={false}
          render={<Link to="/chat" />}
          size="icon-sm"
          variant="ghost"
        >
          <ArrowLeftIcon aria-hidden="true" />
        </Button>
      )}
      <ChatAvatar kind={chat.kind} members={others} size={36} />
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 className="truncate text-sm font-semibold text-balance">
          {other ? (
            <Link
              className="underline-offset-4 hover:underline"
              to={userProfileHref(other.nameCode)}
            >
              {name}
            </Link>
          ) : (
            name
          )}
        </h2>
        <p className="text-muted-foreground truncate text-xs">
          {chat.kind === "group"
            ? t("members", { count: chat.membersCount })
            : chat.me.waitingForAccept
              ? t("waiting")
              : t("direct")}
          {muted ? ` · ${t("muted")}` : null}
          {chat.encrypted ? (
            <span className="ms-1 inline-flex items-center gap-1">
              ·
              <LockIcon aria-hidden="true" className="size-3" />
              {t("encrypted")}
            </span>
          ) : null}
        </p>
      </div>
      {chat.me.status === "accepted" ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button aria-label={t("menu")} size="icon-sm" variant="ghost" />
            }
          >
            <EllipsisVerticalIcon aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            {chat.me.canInvite ? (
              <DropdownMenuItem
                onClick={() => {
                  setDialog("add");
                }}
              >
                <UserPlusIcon aria-hidden="true" />
                {t("add_people")}
              </DropdownMenuItem>
            ) : null}
            {chat.me.canManage ? (
              <DropdownMenuItem
                onClick={() => {
                  setDialog("rename");
                }}
              >
                <PencilIcon aria-hidden="true" />
                {t("rename")}
              </DropdownMenuItem>
            ) : null}
            {muted ? (
              <DropdownMenuItem
                onClick={() =>
                  void update(
                    { chatId: chat.id, mutedUntil: null },
                    { desc: t("unmuted_desc"), title: t("unmuted") },
                  )
                }
              >
                <BellIcon aria-hidden="true" />
                {t("unmute")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <BellOffIcon aria-hidden="true" />
                  {t("mute")}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {muteOptions.map(option => (
                    <DropdownMenuItem
                      key={option.key}
                      onClick={() =>
                        void update(
                          {
                            chatId: chat.id,
                            mutedUntil: new Date(
                              Date.now() + option.hours * 60 * 60 * 1000,
                            ).toISOString(),
                          },
                          { desc: t("muted_desc"), title: t("muted_title") },
                        )
                      }
                    >
                      {t(option.key)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuSeparator />
            {chat.kind === "direct" ? (
              <>
                <DropdownMenuItem
                  onClick={() =>
                    void (async () => {
                      await update(
                        { chatId: chat.id, hidden: true },
                        { desc: t("hidden_desc"), title: t("hidden") },
                      );
                      onLeft?.();
                    })()
                  }
                >
                  <EyeOffIcon aria-hidden="true" />
                  {t("hide")}
                </DropdownMenuItem>
                {other ? (
                  <DropdownMenuItem
                    onClick={() => {
                      setDialog("block");
                    }}
                    variant={chat.me.blockedOther ? undefined : "destructive"}
                  >
                    <BanIcon aria-hidden="true" />
                    {chat.me.blockedOther
                      ? t("unblock", { name: other.name })
                      : t("block", { name: other.name })}
                  </DropdownMenuItem>
                ) : null}
              </>
            ) : (
              <DropdownMenuItem
                onClick={() => {
                  setDialog("leave");
                }}
                variant="destructive"
              >
                <LogOutIcon aria-hidden="true" />
                {t("leave")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <ConfirmActionAlertDialog
        description={t("leave_desc")}
        icon={<LogOutIcon aria-hidden="true" />}
        onOpenChange={open => {
          if (!open) setDialog(null);
        }}
        onSubmit={async ({ onClose }) => {
          try {
            await removeChatMemberRequest({ chatId: chat.id, userId: me.id });
            toast.success(t("left"), { description: t("left_desc") });
            onClose();
            await invalidateChatOverview(queryClient, me.id);
            onLeft?.();
          } catch (error) {
            showError(error);
          }
        }}
        open={dialog === "leave"}
        textSubmit={
          <>
            <LogOutIcon aria-hidden="true" />
            {t("leave")}
          </>
        }
        title={t("leave_title")}
      />

      {other ? (
        <ConfirmActionAlertDialog
          description={
            chat.me.blockedOther
              ? t("unblock_desc", { name: other.name })
              : t("block_desc", { name: other.name })
          }
          icon={<BanIcon aria-hidden="true" />}
          onOpenChange={open => {
            if (!open) setDialog(null);
          }}
          onSubmit={async ({ onClose }) => {
            try {
              await setBlockRequest({
                block: !chat.me.blockedOther,
                userId: other.id,
              });
              toast.success(
                chat.me.blockedOther ? t("unblocked") : t("blocked"),
                {
                  description: chat.me.blockedOther
                    ? t("unblocked_desc", { name: other.name })
                    : t("blocked_desc", { name: other.name }),
                },
              );
              onClose();
              await invalidateChatOverview(queryClient, me.id, chat.id);
            } catch (error) {
              showError(error);
            }
          }}
          open={dialog === "block"}
          submitVariant={chat.me.blockedOther ? "default" : "destructive"}
          textSubmit={
            <>
              <BanIcon aria-hidden="true" />
              {chat.me.blockedOther
                ? t("unblock", { name: other.name })
                : t("block", { name: other.name })}
            </>
          }
          title={
            chat.me.blockedOther
              ? t("unblock_title", { name: other.name })
              : t("block_title", { name: other.name })
          }
        />
      ) : null}

      {dialog === "add" || dialog === "rename" ? (
        <React.Suspense fallback={null}>
          {dialog === "add" ? (
            <LazyAddPeopleDialog
              chat={chat}
              chatKey={chatKey}
              onClose={() => {
                setDialog(null);
              }}
              userId={me.id}
            />
          ) : (
            <LazyRenameDialog
              chat={chat}
              onClose={() => {
                setDialog(null);
              }}
              userId={me.id}
            />
          )}
        </React.Suspense>
      ) : null}
    </header>
  );
};

/**
 * One chat: header, messages and the message box. Used by the `/chat/{id}`
 * page and by the chat dock.
 */
export const ChatView = ({
  chatId,
  me,
  onBack,
  onLeft,
}: {
  chatId: number;
  me: ChatSessionUser;
  /** The dock's back arrow; the page links to `/chat` instead. */
  onBack?: () => void;
  /** After leaving, hiding or ignoring the chat. */
  onLeft?: () => void;
}) => {
  const t = useTranslations("core.global.chat");
  const queryClient = useQueryClient();
  const showError = useChatErrorToast();
  const details = useQuery(chatDetailsQueryOptions({ chatId, userId: me.id }));
  const messages = useInfiniteQuery(
    chatMessagesQueryOptions({ chatId, userId: me.id }),
  );
  const typing = useChatTyping(chatId);
  const [replyTo, setReplyTo] = React.useState<ChatMessage | null>(null);
  const [editing, setEditing] = React.useState<ChatMessage | null>(null);
  const [deleting, setDeleting] = React.useState<ChatMessage | null>(null);
  const [reporting, setReporting] = React.useState<ChatMessage | null>(null);
  const [showJump, setShowJump] = React.useState(false);
  const logRef = React.useRef<HTMLDivElement>(null);
  const topRef = React.useRef<HTMLDivElement>(null);
  const stickToBottom = React.useRef(true);
  const lastMarked = React.useRef(0);
  const [unreadFrom, setUnreadFrom] = React.useState<null | number>(null);

  const chat = details.data;
  const e2e = useChatE2E(me.id);
  const { key: chatKey, status: keyStatus } = useChatKey(chat, e2e.privateKey);
  useChatKeyReshare(chat, chatKey, me.id);
  const rawItems = React.useMemo(
    () =>
      [...(messages.data?.pages ?? [])].reverse().flatMap(page => page.items),
    [messages.data],
  );
  const items = useDecryptedMessages(
    rawItems,
    chatKey,
    `*${t("e2e.cant_decrypt")}*`,
  );
  const names = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const member of chat?.members ?? []) {
      map.set(member.user.id, member.user.name);
    }
    for (const item of items) {
      if (item.author) map.set(item.author.id, item.author.name);
    }

    return map;
  }, [chat?.members, items]);
  const systemLine = useSystemLine(names);
  const newest = items.at(-1);

  if (chat && unreadFrom === null) {
    setUnreadFrom(chat.me.lastReadMessageId);
  }

  // Keep the newest message in view while the member is at the bottom.
  React.useLayoutEffect(() => {
    const log = logRef.current;
    if (!log || !stickToBottom.current) return;
    log.scrollTop = log.scrollHeight;
  }, [items.length, typing.length]);

  // Load older messages when the top comes into view, keeping the anchor.
  React.useEffect(() => {
    const top = topRef.current;
    const log = logRef.current;
    if (!top || !log) return;
    const observer = new IntersectionObserver(
      entries => {
        if (
          !entries[0]?.isIntersecting ||
          !messages.hasNextPage ||
          messages.isFetchingNextPage
        ) {
          return;
        }
        const before = log.scrollHeight;
        void messages.fetchNextPage().then(() => {
          requestAnimationFrame(() => {
            log.scrollTop += log.scrollHeight - before;
          });
        });
      },
      { root: log, rootMargin: "200px 0px 0px 0px" },
    );
    observer.observe(top);

    return () => {
      observer.disconnect();
    };
  }, [messages]);

  // Mark as read once the newest message is shown in a visible tab.
  const markReadNow = () => {
    if (
      !newest ||
      newest.id <= 0 ||
      !chat ||
      chat.me.status !== "accepted" ||
      !stickToBottom.current ||
      document.visibilityState !== "visible" ||
      newest.id <= Math.max(lastMarked.current, chat.me.lastReadMessageId)
    ) {
      return;
    }
    lastMarked.current = newest.id;
    void markChatReadRequest({ chatId, messageId: newest.id })
      .then(async () => {
        await invalidateChatOverview(queryClient, me.id);
      })
      .catch(() => {
        lastMarked.current = 0;
      });
  };
  const markRead = React.useEffectEvent(markReadNow);
  React.useEffect(() => {
    markRead();
  }, [newest?.id, chat?.me.status]);
  React.useEffect(() => {
    const onVisible = () => {
      markRead();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const jumpTo = (messageId: number) => {
    const element = document.getElementById(`chat-message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.focus({ preventScroll: true });

      return;
    }
    toast.info(t("message.not_loaded"), {
      description: t("message.not_loaded_desc"),
    });
  };

  const actions: ChatMessageActions = {
    canEdit: message =>
      Date.now() - new Date(message.createdAt).getTime() < 15 * 60 * 1000,
    canReact: chat?.me.status === "accepted",
    onDelete: setDeleting,
    onEdit: message => {
      setReplyTo(null);
      setEditing(message);
    },
    onJumpTo: jumpTo,
    onReact: (message, emoji, add) => {
      patchCachedMessage(queryClient, me.id, chatId, message.id, item => {
        const existing = item.reactions.find(
          reaction => reaction.emoji === emoji,
        );
        let reactions = item.reactions;
        if (add && !existing?.reacted) {
          reactions = existing
            ? reactions.map(reaction =>
                reaction.emoji === emoji
                  ? { ...reaction, count: reaction.count + 1, reacted: true }
                  : reaction,
              )
            : [...reactions, { count: 1, emoji, reacted: true }];
        } else if (!add && existing?.reacted) {
          reactions = reactions
            .map(reaction =>
              reaction.emoji === emoji
                ? { ...reaction, count: reaction.count - 1, reacted: false }
                : reaction,
            )
            .filter(reaction => reaction.count > 0);
        }

        return { ...item, reactions };
      });
      void setChatReactionRequest({
        add,
        chatId,
        emoji,
        messageId: message.id,
      })
        .then(result => {
          patchCachedMessage(queryClient, me.id, chatId, message.id, item => ({
            ...item,
            reactions: result.reactions,
          }));
        })
        .catch(async (error: unknown) => {
          showError(error);
          await messages.refetch();
        });
    },
    onReply: message => {
      setEditing(null);
      setReplyTo(message);
    },
    onReport: message => {
      if (!message.encrypted) {
        setReporting(message);

        return;
      }
      // Moderators can't read an encrypted chat: reveal the reported message
      // and the few before it, checked by the server against each commitment.
      const index = rawItems.findIndex(item => item.id === message.id);
      const disclosed = rawItems
        .slice(Math.max(0, index - 5), index + 1)
        .flatMap(item => {
          if (item.kind !== "message" || !item.encrypted || !item.body) {
            return [];
          }
          const value = peekDecrypted(item.body);

          return value && value !== "error"
            ? [{ frankingKey: value.fk, messageId: item.id, text: value.t }]
            : [];
        });
      void discloseChatMessagesRequest({
        chatId,
        messageId: message.id,
        messages: disclosed,
      })
        .then(() => {
          setReporting(message);
        })
        .catch(showError);
    },
  };

  if (details.isPending || messages.isPending) return <ChatViewSkeleton />;

  if (details.isError || !chat) {
    const notFound =
      details.error &&
      "status" in details.error &&
      details.error.status === 404;

    return (
      <Empty className="flex-1" role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessagesSquareIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>
            {notFound ? t("not_found.title") : t("load_error.title")}
          </EmptyTitle>
          <EmptyDescription>
            {notFound ? t("not_found.desc") : t("load_error.desc")}
          </EmptyDescription>
        </EmptyHeader>
        {notFound ? null : (
          <EmptyContent>
            <Button
              isLoading={details.isFetching}
              onClick={() => void details.refetch()}
              size="sm"
              variant="outline"
            >
              <RotateCwIcon aria-hidden="true" />
              {t("retry")}
            </Button>
          </EmptyContent>
        )}
      </Empty>
    );
  }

  const otherReads = chat.members
    .filter(
      member => member.user.id !== me.id && member.lastReadMessageId !== null,
    )
    .map(member => ({
      lastRead: member.lastReadMessageId ?? 0,
      name: member.user.name,
    }));
  const myLast = [...items]
    .reverse()
    .find(item => item.author?.id === me.id && item.kind === "message");
  const seenBy =
    myLast && myLast.id > 0
      ? otherReads.filter(read => read.lastRead >= myLast.id)
      : [];
  const typingNames = typing
    .filter(id => id !== me.id)
    .map(id => names.get(id))
    .filter((name): name is string => !!name);
  const pendingGroup = chat.me.status === "pending" && chat.kind === "group";
  const lockedOut = chat.encrypted && keyStatus === "locked";
  const encryptText =
    chat.encrypted && chatKey
      ? async (text: string) => await encryptChatMessage(chatKey, text)
      : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatHeader
        chat={chat}
        chatKey={chatKey}
        me={me}
        onBack={onBack}
        onLeft={onLeft}
      />
      {chat.me.status === "pending" ? (
        <RequestBar chat={chat} onDone={onLeft} userId={me.id} />
      ) : null}
      {chat.me.waitingForAccept ? (
        <p className="bg-muted/50 text-muted-foreground border-b px-3 py-2 text-sm leading-relaxed text-pretty">
          {t("waiting", {
            count: chat.me.pendingMessagesLeft ?? 0,
            name:
              chat.members.find(member => member.user.id !== me.id)?.user
                .name ?? "",
          })}
        </p>
      ) : null}
      {chat.encrypted && keyStatus === "locked" ? (
        <ChatUnlockPanel userId={me.id} />
      ) : null}
      {chat.encrypted &&
      (keyStatus === "missing" || keyStatus === "error") &&
      !pendingGroup ? (
        <Alert className="m-2" variant="warning">
          <AlertDescription>
            {keyStatus === "missing"
              ? t("e2e.missing_key")
              : t("e2e.key_error")}
          </AlertDescription>
        </Alert>
      ) : null}
      {messages.isError && items.length > 0 ? (
        <Alert className="m-2" variant="warning">
          <AlertDescription className="flex items-center justify-between gap-2">
            {t("refetch_error")}
            <Button
              isLoading={messages.isFetching}
              onClick={() => void messages.refetch()}
              size="sm"
              variant="outline"
            >
              <RotateCwIcon aria-hidden="true" />
              {t("retry")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col" hidden={lockedOut}>
        <div
          aria-busy={messages.isFetchingNextPage}
          aria-label={t("log_label")}
          className="min-h-0 flex-1 overflow-y-auto px-3 pb-2"
          onScroll={event => {
            const log = event.currentTarget;
            const atBottom =
              log.scrollHeight - log.scrollTop - log.clientHeight <
              NEAR_BOTTOM_PX;
            stickToBottom.current = atBottom;
            setShowJump(!atBottom);
            if (atBottom) markReadNow();
          }}
          ref={logRef}
          role="log"
          tabIndex={0}
        >
          <div ref={topRef} />
          {messages.isFetchingNextPage ? (
            <div className="flex justify-center p-2" role="status">
              <Skeleton className="h-4 w-32" />
              <span className="sr-only">{t("loading_older")}</span>
            </div>
          ) : null}
          {pendingGroup ? (
            <p className="text-muted-foreground p-6 text-center text-sm text-pretty">
              {t("request.group_hidden")}
            </p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm text-pretty">
              {t("empty_chat")}
            </p>
          ) : null}
          {items.map((message, index) => {
            const previous = items[index - 1];
            const next = items[index + 1];
            const newDay =
              !previous ||
              dayKey(previous.createdAt) !== dayKey(message.createdAt);
            const showUnread =
              unreadFrom !== null &&
              unreadFrom > 0 &&
              message.id > unreadFrom &&
              (!previous || previous.id <= unreadFrom) &&
              message.author?.id !== me.id;

            return (
              <React.Fragment key={message.clientId ?? message.id}>
                {newDay ? (
                  <div className="text-muted-foreground my-3 flex items-center gap-3 text-xs">
                    <span className="bg-border h-px flex-1" />
                    <time dateTime={message.createdAt}>
                      {new Date(message.createdAt).toLocaleDateString(
                        undefined,
                        { day: "numeric", month: "long", weekday: "long" },
                      )}
                    </time>
                    <span className="bg-border h-px flex-1" />
                  </div>
                ) : null}
                {showUnread ? (
                  <div className="text-primary my-2 flex items-center gap-3 text-xs font-medium">
                    <span className="bg-primary/40 h-px flex-1" />
                    {t("new_messages")}
                    <span className="bg-primary/40 h-px flex-1" />
                  </div>
                ) : null}
                {message.kind === "system" && message.system ? (
                  <p className="text-muted-foreground my-2 text-center text-xs text-pretty">
                    {systemLine(message.system, message.author?.id ?? null)}
                  </p>
                ) : (
                  <ChatMessageItem
                    actions={actions}
                    grouped={!newDay && sameRun(previous, message)}
                    isOwn={message.author?.id === me.id}
                    message={message}
                    showAuthor={chat.kind === "group"}
                    showTime={!sameRun(message, next)}
                  />
                )}
                {myLast && message.id === myLast.id && seenBy.length > 0 ? (
                  <p className="text-muted-foreground px-1 text-end text-xs">
                    {chat.kind === "direct"
                      ? t("seen")
                      : t("seen_by", {
                          count: seenBy.length,
                          names: seenBy
                            .slice(0, 3)
                            .map(read => read.name)
                            .join(", "),
                        })}
                  </p>
                ) : null}
              </React.Fragment>
            );
          })}
          {typingNames.length > 0 ? (
            <p
              aria-live="polite"
              className="text-muted-foreground px-1 pt-2 text-xs motion-safe:animate-pulse"
            >
              {t("typing", {
                count: typingNames.length,
                name: typingNames[0],
              })}
            </p>
          ) : null}
        </div>
        {showJump ? (
          <Button
            className="absolute end-4 bottom-3 rounded-full shadow-md"
            onClick={() => {
              const log = logRef.current;
              if (log)
                log.scrollTo({ behavior: "smooth", top: log.scrollHeight });
            }}
            size="sm"
            variant="secondary"
          >
            <ArrowDownIcon aria-hidden="true" />
            {t("jump_latest")}
          </Button>
        ) : null}
      </div>

      {lockedOut ? null : (
        <ChatComposer
          chatId={chatId}
          disabled={
            !chat.me.canWrite || pendingGroup || (chat.encrypted && !chatKey)
          }
          editing={editing}
          encryptText={encryptText}
          me={me}
          onCancelEdit={() => {
            setEditing(null);
          }}
          onCancelReply={() => {
            setReplyTo(null);
          }}
          onSent={() => {
            stickToBottom.current = true;
          }}
          replyTo={replyTo}
        />
      )}

      <ConfirmActionAlertDialog
        description={t("message.delete_desc")}
        icon={<Trash2Icon aria-hidden="true" />}
        onOpenChange={open => {
          if (!open) setDeleting(null);
        }}
        onSubmit={async ({ onClose }) => {
          if (!deleting) return;
          try {
            await deleteChatMessageRequest({
              chatId,
              messageId: deleting.id,
            });
            patchCachedMessage(
              queryClient,
              me.id,
              chatId,
              deleting.id,
              item => ({
                ...item,
                body: null,
                deleted: true,
                reactions: [],
              }),
            );
            toast.success(t("message.deleted_toast"), {
              description: t("message.deleted_toast_desc"),
            });
            onClose();
          } catch (error) {
            showError(error);
          }
        }}
        open={deleting !== null}
        textSubmit={
          <>
            <Trash2Icon aria-hidden="true" />
            {t("message.delete")}
          </>
        }
        title={t("message.delete_title")}
      />

      {reporting ? (
        <React.Suspense fallback={null}>
          <RouteMessages namespaces={REPORT_NAMESPACES}>
            <ReportDialog
              onOpenChange={open => {
                if (!open) setReporting(null);
              }}
              open
              preview={{
                meta: reporting.author?.name,
                title: reporting.body ?? "",
              }}
              target={{
                id: String(reporting.id),
                pluginId: manifest.id,
                type: "chat.message",
              }}
              typeLabel={t("message.report_type")}
            />
          </RouteMessages>
        </React.Suspense>
      ) : null}
    </div>
  );
};
