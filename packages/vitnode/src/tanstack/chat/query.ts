import type { ContentPublicPerson } from "@vitnode/api/content/public-person";
import type { ChatRequestsFrom } from "@vitnode/api/lib/chat/const";
import type {
  ChatKeyGrant,
  ChatWrappedPrivateKey,
} from "@vitnode/api/lib/chat/e2e";
import type {
  ChatDetails,
  ChatListItem,
  ChatMessage,
  ChatReactionSummary,
  ChatState,
} from "@vitnode/api/lib/chat/types";

import {
  type InfiniteData,
  infiniteQueryOptions,
  type QueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { manifest } from "@vitnode/api/manifest";

import { OPERATIONAL_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";

/** A chat request answered with an error; `code` is the API's error code. */
export class ChatRequestError extends Error {
  constructor(status: number, code: string) {
    super(`The chat API answered ${status} (${code}).`);
    this.name = "ChatRequestError";
    this.status = status;
    this.code = code;
  }
  readonly code: string;

  readonly status: number;
}

const failed = async (response: Response): Promise<never> => {
  const body = (await response.json().catch(() => null)) as null | {
    error?: unknown;
  };
  throw new ChatRequestError(
    response.status,
    typeof body?.error === "string" ? body.error : "unknown",
  );
};

export const CHAT_ROOT = ["chat", "user"] as const;
export const chatRoot = (userId: number) => [...CHAT_ROOT, userId] as const;
export const chatListRoot = (userId: number) =>
  [...chatRoot(userId), "list"] as const;
export const chatDetailsKey = (userId: number, chatId: number) =>
  [...chatRoot(userId), "chat", chatId] as const;
export const chatMessagesKey = (userId: number, chatId: number) =>
  [...chatRoot(userId), "messages", chatId] as const;
export const chatStateKey = (userId: number) =>
  [...chatRoot(userId), "state"] as const;

export type ChatListFilter = "all" | "requests" | "unread";

export interface ChatListPage {
  items: ChatListItem[];
  nextCursor: null | number;
}

export interface ChatMessagesPage {
  hasNewer: boolean;
  hasOlder: boolean;
  items: ChatMessage[];
}

export const chatStateQueryOptions = (userId: number) =>
  queryOptions({
    queryFn: async ({ signal }): Promise<ChatState> => {
      const response = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "chat",
        options: { signal },
        path: "/state",
      });
      if (!response.ok) return await failed(response);

      return await response.json();
    },
    queryKey: chatStateKey(userId),
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });

export const chatListQueryOptions = ({
  filter,
  userId,
}: {
  filter: ChatListFilter;
  userId: number;
}) =>
  infiniteQueryOptions({
    getNextPageParam: (page: ChatListPage) => page.nextCursor ?? undefined,
    initialPageParam: null as null | number,
    queryFn: async ({ pageParam, signal }): Promise<ChatListPage> => {
      const response = await fetcher({
        plugin: manifest.id,
        args: {
          query: {
            cursor: pageParam ? String(pageParam) : undefined,
            filter,
          },
        },
        method: "get",
        module: "chat",
        options: { signal },
        path: "/",
      });
      if (!response.ok) return await failed(response);

      return await response.json();
    },
    queryKey: [...chatListRoot(userId), filter] as const,
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });

export const chatDetailsQueryOptions = ({
  chatId,
  userId,
}: {
  chatId: number;
  userId: number;
}) =>
  queryOptions({
    queryFn: async ({ signal }): Promise<ChatDetails> => {
      const response = await fetcher({
        plugin: manifest.id,
        args: { params: { chatId: String(chatId) } },
        method: "get",
        module: "chat",
        options: { signal },
        path: "/{chatId}",
      });
      if (!response.ok) return await failed(response);

      return await response.json();
    },
    queryKey: chatDetailsKey(userId, chatId),
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });

/** Pages of messages; page params page backwards from the newest. */
export const chatMessagesQueryOptions = ({
  chatId,
  userId,
}: {
  chatId: number;
  userId: number;
}) =>
  infiniteQueryOptions({
    getNextPageParam: (page: ChatMessagesPage) =>
      page.hasOlder ? page.items[0]?.id : undefined,
    initialPageParam: null as null | number,
    queryFn: async ({ pageParam, signal }): Promise<ChatMessagesPage> => {
      const response = await fetcher({
        plugin: manifest.id,
        args: {
          params: { chatId: String(chatId) },
          query: { before: pageParam ? String(pageParam) : undefined },
        },
        method: "get",
        module: "chat",
        options: { signal },
        path: "/{chatId}/messages",
      });
      if (!response.ok) return await failed(response);

      return await response.json();
    },
    queryKey: chatMessagesKey(userId, chatId),
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });

export interface ChatSettingsView {
  chatRequestsFrom: ChatRequestsFrom;
  showReadReceipts: boolean;
}

export const chatSettingsQueryOptions = (userId: number) =>
  queryOptions({
    queryFn: async ({ signal }): Promise<ChatSettingsView> => {
      const response = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "chat",
        options: { signal },
        path: "/settings",
      });
      if (!response.ok) return await failed(response);

      return await response.json();
    },
    queryKey: [...chatRoot(userId), "settings"] as const,
    retry: false,
  });

export interface BlockedMember {
  blockedAt: string;
  user: ContentPublicPerson;
}

export const blockedMembersQueryOptions = (userId: number) =>
  queryOptions({
    queryFn: async ({ signal }): Promise<{ items: BlockedMember[] }> => {
      const response = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "users",
        options: { signal },
        path: "/blocks",
      });
      if (!response.ok) return await failed(response);

      return await response.json();
    },
    queryKey: [...chatRoot(userId), "blocks"] as const,
    retry: false,
  });

export const canChatQueryOptions = ({
  targetId,
  userId,
}: {
  targetId: number;
  userId: number;
}) =>
  queryOptions({
    queryFn: async ({ signal }) => {
      const response = await fetcher({
        plugin: manifest.id,
        args: { params: { userId: String(targetId) } },
        method: "get",
        module: "chat",
        options: { signal },
        path: "/can-chat/{userId}",
      });
      if (!response.ok) return await failed(response);

      return await response.json();
    },
    queryKey: [...chatRoot(userId), "can-chat", targetId] as const,
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });

export const searchChatPeople = async (
  q: string,
  signal?: AbortSignal,
): Promise<ContentPublicPerson[]> => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { query: { q } },
    method: "get",
    module: "chat",
    options: { signal },
    path: "/people",
  });
  if (!response.ok) return await failed(response);

  return (await response.json()).items;
};

export const startChatRequest = async (body: {
  body?: string;
  clientId?: string;
  commitment?: string;
  encrypted?: boolean;
  keys?: ChatKeyGrant[];
  title?: string;
  userIds: number[];
}): Promise<{ chatId: number; created: boolean }> => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { body },
    method: "post",
    module: "chat",
    path: "/",
  });
  if (!response.ok) return await failed(response);

  return await response.json();
};

export const sendChatMessageRequest = async ({
  chatId,
  ...body
}: {
  body: string;
  chatId: number;
  clientId?: string;
  commitment?: string;
  replyToMessageId?: number;
}): Promise<ChatMessage> => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { body, params: { chatId: String(chatId) } },
    method: "post",
    module: "chat",
    path: "/{chatId}/messages",
  });
  if (!response.ok) return await failed(response);

  return await response.json();
};

export const editChatMessageRequest = async ({
  body,
  chatId,
  commitment,
  messageId,
}: {
  body: string;
  chatId: number;
  commitment?: string;
  messageId: number;
}): Promise<ChatMessage> => {
  const response = await fetcher({
    plugin: manifest.id,
    args: {
      body: { body, commitment },
      params: { chatId: String(chatId), messageId: String(messageId) },
    },
    method: "patch",
    module: "chat",
    path: "/{chatId}/messages/{messageId}",
  });
  if (!response.ok) return await failed(response);

  return await response.json();
};

export const deleteChatMessageRequest = async ({
  chatId,
  messageId,
}: {
  chatId: number;
  messageId: number;
}): Promise<void> => {
  const response = await fetcher({
    plugin: manifest.id,
    args: {
      params: { chatId: String(chatId), messageId: String(messageId) },
    },
    method: "delete",
    module: "chat",
    path: "/{chatId}/messages/{messageId}",
  });
  if (!response.ok) await failed(response);
};

export const setChatReactionRequest = async ({
  add,
  chatId,
  emoji,
  messageId,
}: {
  add: boolean;
  chatId: number;
  emoji: string;
  messageId: number;
}): Promise<{ reactions: ChatReactionSummary[] }> => {
  const params = {
    chatId: String(chatId),
    emoji: encodeURIComponent(emoji),
    messageId: String(messageId),
  };
  const response = add
    ? await fetcher({
        plugin: manifest.id,
        args: { params },
        method: "put",
        module: "chat",
        path: "/{chatId}/messages/{messageId}/reactions/{emoji}",
      })
    : await fetcher({
        plugin: manifest.id,
        args: { params },
        method: "delete",
        module: "chat",
        path: "/{chatId}/messages/{messageId}/reactions/{emoji}",
      });
  if (!response.ok) return await failed(response);

  return await response.json();
};

export const markChatReadRequest = async ({
  chatId,
  messageId,
}: {
  chatId: number;
  messageId: number;
}): Promise<void> => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { body: { messageId }, params: { chatId: String(chatId) } },
    method: "post",
    module: "chat",
    path: "/{chatId}/read",
  });
  if (!response.ok) await failed(response);
};

export const acceptChatRequest = async (chatId: number): Promise<void> => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { params: { chatId: String(chatId) } },
    method: "post",
    module: "chat",
    path: "/{chatId}/accept",
  });
  if (!response.ok) await failed(response);
};

export const ignoreChatRequest = async ({
  block,
  chatId,
}: {
  block: boolean;
  chatId: number;
}): Promise<void> => {
  const response = await fetcher({
    plugin: manifest.id,
    args: {
      params: { chatId: String(chatId) },
      query: { block: block ? "true" : undefined },
    },
    method: "post",
    module: "chat",
    path: "/{chatId}/ignore",
  });
  if (!response.ok) await failed(response);
};

export const updateChatRequest = async ({
  chatId,
  ...body
}: {
  chatId: number;
  hidden?: boolean;
  membersCanInvite?: boolean;
  mutedUntil?: null | string;
  title?: null | string;
}): Promise<void> => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { body, params: { chatId: String(chatId) } },
    method: "patch",
    module: "chat",
    path: "/{chatId}",
  });
  if (!response.ok) await failed(response);
};

export const addChatMembersRequest = async ({
  chatId,
  keys,
  userIds,
}: {
  chatId: number;
  keys?: ChatKeyGrant[];
  userIds: number[];
}): Promise<void> => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { body: { keys, userIds }, params: { chatId: String(chatId) } },
    method: "post",
    module: "chat",
    path: "/{chatId}/members",
  });
  if (!response.ok) await failed(response);
};

export const removeChatMemberRequest = async ({
  chatId,
  userId,
}: {
  chatId: number;
  userId: number;
}): Promise<void> => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { params: { chatId: String(chatId), userId: String(userId) } },
    method: "delete",
    module: "chat",
    path: "/{chatId}/members/{userId}",
  });
  if (!response.ok) await failed(response);
};

export const updateChatSettingsRequest = async (
  body: ChatSettingsView,
): Promise<ChatSettingsView> => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { body },
    method: "put",
    module: "chat",
    path: "/settings",
  });
  if (!response.ok) return await failed(response);

  return await response.json();
};

export const setBlockRequest = async ({
  block,
  userId,
}: {
  block: boolean;
  userId: number;
}): Promise<void> => {
  const params = { userId: String(userId) };
  const response = block
    ? await fetcher({
        plugin: manifest.id,
        args: { params },
        method: "put",
        module: "users",
        path: "/blocks/{userId}",
      })
    : await fetcher({
        plugin: manifest.id,
        args: { params },
        method: "delete",
        module: "users",
        path: "/blocks/{userId}",
      });
  if (!response.ok) await failed(response);
};

/** Puts a message into the cached pages: replaces it by id or client id, or appends it. */
export const upsertCachedMessage = (
  queryClient: QueryClient,
  userId: number,
  message: ChatMessage,
): void => {
  queryClient.setQueryData<InfiniteData<ChatMessagesPage, null | number>>(
    chatMessagesKey(userId, message.chatId),
    data => {
      if (!data) return data;
      let found = false;
      const pages = data.pages.map(page => ({
        ...page,
        items: page.items.map(item => {
          if (
            item.id === message.id ||
            (message.clientId !== null && item.clientId === message.clientId)
          ) {
            found = true;

            return message;
          }

          return item;
        }),
      }));
      if (!found && pages.length > 0 && !pages[0].hasNewer) {
        pages[0] = { ...pages[0], items: [...pages[0].items, message] };
      }

      return { ...data, pages };
    },
  );
};

/** Updates one cached message in place. */
export const patchCachedMessage = (
  queryClient: QueryClient,
  userId: number,
  chatId: number,
  messageId: number,
  patch: (message: ChatMessage) => ChatMessage,
): void => {
  queryClient.setQueryData<InfiniteData<ChatMessagesPage, null | number>>(
    chatMessagesKey(userId, chatId),
    data =>
      data && {
        ...data,
        pages: data.pages.map(page => ({
          ...page,
          items: page.items.map(item =>
            item.id === messageId ? patch(item) : item,
          ),
        })),
      },
  );
};

/** Refetches the chat list, the state and one chat's header. */
export const invalidateChatOverview = async (
  queryClient: QueryClient,
  userId: number,
  chatId?: number,
): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: chatListRoot(userId) }),
    queryClient.invalidateQueries({ queryKey: chatStateKey(userId) }),
    chatId
      ? queryClient.invalidateQueries({
          queryKey: chatDetailsKey(userId, chatId),
        })
      : Promise.resolve(),
  ]);
};

/** Drops one message from the cached pages, such as a failed optimistic send. */
export const removeCachedMessage = (
  queryClient: QueryClient,
  userId: number,
  chatId: number,
  messageId: number,
): void => {
  queryClient.setQueryData<InfiniteData<ChatMessagesPage, null | number>>(
    chatMessagesKey(userId, chatId),
    data =>
      data && {
        ...data,
        pages: data.pages.map(page => ({
          ...page,
          items: page.items.filter(item => item.id !== messageId),
        })),
      },
  );
};

export interface OwnChatKeys {
  keyVersion: number;
  passcodeKey: ChatWrappedPrivateKey;
  publicKey: string;
  recoveryKey: ChatWrappedPrivateKey;
}

export const ownChatKeysQueryOptions = (userId: number) =>
  queryOptions({
    queryFn: async ({
      signal,
    }): Promise<{ keys: null | OwnChatKeys; required: boolean }> => {
      const response = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "chat",
        options: { signal },
        path: "/keys/me",
      });
      if (!response.ok) return await failed(response);

      return await response.json();
    },
    queryKey: [...chatRoot(userId), "keys", "me"] as const,
    retry: false,
    staleTime: Infinity,
  });

export const saveOwnChatKeysRequest = async (
  body:
    | {
        mode: "reset" | "setup";
        passcodeKey: ChatWrappedPrivateKey;
        publicKey: string;
        recoveryKey: ChatWrappedPrivateKey;
      }
    | {
        mode: "update";
        passcodeKey?: ChatWrappedPrivateKey;
        recoveryKey?: ChatWrappedPrivateKey;
      },
): Promise<{ keyVersion: number }> => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { body },
    method: "put",
    module: "chat",
    path: "/keys/me",
  });
  if (!response.ok) return await failed(response);

  return await response.json();
};

export const fetchPublicChatKeys = async (
  userIds: readonly number[],
): Promise<{ keyVersion: number; publicKey: string; userId: number }[]> => {
  if (userIds.length === 0) return [];
  const response = await fetcher({
    plugin: manifest.id,
    args: { query: { userIds: userIds.join(",") } },
    method: "get",
    module: "chat",
    path: "/keys",
  });
  if (!response.ok) return await failed(response);

  return (await response.json()).items;
};

export const rewrapChatKeysRequest = async ({
  chatId,
  keys,
}: {
  chatId: number;
  keys: ChatKeyGrant[];
}): Promise<void> => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { body: { keys }, params: { chatId: String(chatId) } },
    method: "put",
    module: "chat",
    path: "/{chatId}/keys",
  });
  if (!response.ok) await failed(response);
};

export const discloseChatMessagesRequest = async ({
  chatId,
  messageId,
  messages,
}: {
  chatId: number;
  messageId: number;
  messages: { frankingKey: string; messageId: number; text: string }[];
}): Promise<void> => {
  const response = await fetcher({
    plugin: manifest.id,
    args: {
      body: { messages },
      params: { chatId: String(chatId), messageId: String(messageId) },
    },
    method: "post",
    module: "chat",
    path: "/{chatId}/messages/{messageId}/disclose",
  });
  if (!response.ok) await failed(response);
};
