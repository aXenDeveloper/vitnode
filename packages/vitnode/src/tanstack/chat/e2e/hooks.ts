import type { ChatDetails, ChatMessage } from "@vitnode/api/lib/chat/types";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";

import {
  chatDetailsKey,
  chatRoot,
  chatStateKey,
  type OwnChatKeys,
  ownChatKeysQueryOptions,
  rewrapChatKeysRequest,
  saveOwnChatKeysRequest,
} from "../query";
import {
  decryptChatMessage,
  generateIdentity,
  generateRecoveryKey,
  importPrivateKey,
  unwrapChatKey,
  unwrapPrivateKeyBytes,
  wrapChatKey,
  wrapPrivateKey,
} from "./crypto";
import { e2eStore, useE2EStoreVersion } from "./store";

export type E2EStatus = "loading" | "locked" | "none" | "unlocked";

/** Thrown when a passcode or recovery key doesn't open the private key. */
export class WrongSecretError extends Error {
  constructor() {
    super("The passcode or recovery key is wrong.");
    this.name = "WrongSecretError";
  }
}

const openPrivateKey = async (
  keys: OwnChatKeys,
  secret: { passcode: string } | { recoveryKey: string },
) => {
  try {
    return await unwrapPrivateKeyBytes(
      "passcode" in secret ? keys.passcodeKey : keys.recoveryKey,
      secret,
    );
  } catch {
    throw new WrongSecretError();
  }
};

/**
 * The member's end-to-end encryption: whether they set a passcode, whether
 * this tab is unlocked, and every action on their keys. Browser-only.
 */
export const useChatE2E = (userId: number) => {
  useE2EStoreVersion();
  const queryClient = useQueryClient();
  const query = useQuery(ownChatKeysQueryOptions(userId));
  const own = query.data?.keys ?? null;

  React.useEffect(() => {
    void e2eStore.restore(userId);
  }, [userId]);

  const current = e2eStore.current();
  const unlocked =
    current?.userId === userId && own?.keyVersion === current.keyVersion
      ? current
      : null;
  let status: E2EStatus = "loading";
  if (!query.isPending) {
    if (!own) status = "none";
    else status = unlocked ? "unlocked" : "locked";
  }

  const refresh = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ownChatKeysQueryOptions(userId).queryKey,
      }),
      queryClient.invalidateQueries({ queryKey: chatStateKey(userId) }),
      queryClient.invalidateQueries({ queryKey: chatRoot(userId) }),
    ]);
  }, [queryClient, userId]);

  const keep = async (
    pkcs8: Uint8Array<ArrayBuffer>,
    keyVersion: number,
    remember: boolean,
  ) => {
    await e2eStore.unlock(
      { keyVersion, privateKey: await importPrivateKey(pkcs8), userId },
      remember,
    );
  };

  return {
    isError: query.isError,
    keyVersion: own?.keyVersion ?? null,
    privateKey: unlocked?.privateKey ?? null,
    refetch: query.refetch,
    required: query.data?.required ?? false,
    status,

    /** First passcode: new keys. Returns the recovery key to show once. */
    async setup(passcode: string, remember: boolean): Promise<string> {
      const identity = await generateIdentity();
      const recoveryKey = generateRecoveryKey();
      const { keyVersion } = await saveOwnChatKeysRequest({
        mode: "setup",
        passcodeKey: await wrapPrivateKey(identity.pkcs8, { passcode }),
        publicKey: identity.publicKey,
        recoveryKey: await wrapPrivateKey(identity.pkcs8, { recoveryKey }),
      });
      await keep(identity.pkcs8, keyVersion, remember);
      await refresh();

      return recoveryKey;
    },

    async unlock(passcode: string, remember: boolean): Promise<void> {
      if (!own) return;
      await keep(
        await openPrivateKey(own, { passcode }),
        own.keyVersion,
        remember,
      );
    },

    /** Forgot the passcode: the recovery key opens the keys, a new passcode replaces the old. */
    async recover(
      recoveryKey: string,
      passcode: string,
      remember: boolean,
    ): Promise<void> {
      if (!own) return;
      const pkcs8 = await openPrivateKey(own, { recoveryKey });
      await saveOwnChatKeysRequest({
        mode: "update",
        passcodeKey: await wrapPrivateKey(pkcs8, { passcode }),
      });
      await keep(pkcs8, own.keyVersion, remember);
      await refresh();
    },

    async changePasscode(current: string, next: string): Promise<void> {
      if (!own) return;
      const pkcs8 = await openPrivateKey(own, { passcode: current });
      await saveOwnChatKeysRequest({
        mode: "update",
        passcodeKey: await wrapPrivateKey(pkcs8, { passcode: next }),
      });
      await refresh();
    },

    /** A new recovery key; the old one stops working. */
    async newRecoveryKey(passcode: string): Promise<string> {
      if (!own) return "";
      const pkcs8 = await openPrivateKey(own, { passcode });
      const recoveryKey = generateRecoveryKey();
      await saveOwnChatKeysRequest({
        mode: "update",
        recoveryKey: await wrapPrivateKey(pkcs8, { recoveryKey }),
      });
      await refresh();

      return recoveryKey;
    },

    /** Lost both: new keys. Encrypted chats need someone to share them again. */
    async reset(passcode: string, remember: boolean): Promise<string> {
      const identity = await generateIdentity();
      const recoveryKey = generateRecoveryKey();
      const { keyVersion } = await saveOwnChatKeysRequest({
        mode: "reset",
        passcodeKey: await wrapPrivateKey(identity.pkcs8, { passcode }),
        publicKey: identity.publicKey,
        recoveryKey: await wrapPrivateKey(identity.pkcs8, { recoveryKey }),
      });
      await keep(identity.pkcs8, keyVersion, remember);
      await refresh();

      return recoveryKey;
    },

    async lock(): Promise<void> {
      await e2eStore.lock(userId);
    },
  };
};

export type ChatKeyStatus =
  | "error"
  | "loading"
  | "locked"
  | "missing"
  | "plain"
  | "ready";

/**
 * The open chat's key: unwrapped with the member's private key once, then
 * cached for the tab. `missing` when the member has no key for their current
 * keys (they reset) - another member's browser shares it again on its own.
 */
export const useChatKey = (
  chat: ChatDetails | undefined,
  privateKey: CryptoKey | null,
): { key: CryptoKey | null; status: ChatKeyStatus } => {
  useE2EStoreVersion();
  const [failed, setFailed] = React.useState<null | string>(null);
  const grant = chat?.me.chatKey ?? null;
  const cached =
    chat && grant ? e2eStore.chatKey(chat.id, grant.keyVersion) : null;
  const attempt = chat && grant ? `${chat.id}:${grant.keyVersion}` : null;

  React.useEffect(() => {
    if (!chat || !grant || !privateKey || cached) return;
    let cancelled = false;
    void unwrapChatKey(grant.wrappedKey, privateKey)
      .then(key => {
        if (!cancelled) e2eStore.setChatKey(chat.id, grant.keyVersion, key);
      })
      .catch(() => {
        if (!cancelled) setFailed(attempt);
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, cached, chat, grant, privateKey]);

  if (!chat?.encrypted) return { key: null, status: "plain" };
  if (!privateKey) return { key: null, status: "locked" };
  if (!grant) return { key: null, status: "missing" };
  if (cached) return { key: cached, status: "ready" };
  if (failed === attempt) return { key: null, status: "error" };

  return { key: null, status: "loading" };
};

/**
 * Shares the chat key with members who lost theirs, from any member who
 * holds it. Runs once per member and key version per tab.
 */
export const useChatKeyReshare = (
  chat: ChatDetails | undefined,
  chatKey: CryptoKey | null,
  userId: number,
) => {
  const queryClient = useQueryClient();
  const done = React.useRef(new Set<string>());

  React.useEffect(() => {
    if (!chat?.encrypted || !chatKey || chat.me.status !== "accepted") return;
    const missing = chat.members.filter(
      member =>
        !member.hasChatKey &&
        member.publicKey &&
        member.keyVersion !== null &&
        !done.current.has(`${member.user.id}:${member.keyVersion}`),
    );
    if (missing.length === 0) return;
    for (const member of missing) {
      done.current.add(`${member.user.id}:${member.keyVersion}`);
    }
    void (async () => {
      const keys = await Promise.all(
        missing.map(async member => ({
          keyVersion: member.keyVersion ?? 0,
          userId: member.user.id,
          wrappedKey: await wrapChatKey(chatKey, member.publicKey ?? ""),
        })),
      );
      await rewrapChatKeysRequest({ chatId: chat.id, keys }).catch(() => {});
      await queryClient.invalidateQueries({
        queryKey: chatDetailsKey(userId, chat.id),
      });
    })();
  }, [chat, chatKey, queryClient, userId]);
};

type Decrypted = "error" | { fk: string; t: string };

const decrypted = new Map<string, Decrypted>();
const MAX_CACHED = 3000;

const remember = (body: string, value: Decrypted) => {
  if (decrypted.size >= MAX_CACHED) {
    const first = decrypted.keys().next().value;
    if (first !== undefined) decrypted.delete(first);
  }
  decrypted.set(body, value);
};

/** Decrypts one body with a key, from cache when it can. */
export const decryptCached = async (
  key: CryptoKey,
  body: string,
): Promise<Decrypted> => {
  const cached = decrypted.get(body);
  if (cached) return cached;
  const value = await decryptChatMessage(key, body).catch(
    () => "error" as const,
  );
  remember(body, value);

  return value;
};

/** What `body` decrypted to, if it has been decrypted already. */
export const peekDecrypted = (body: string): Decrypted | undefined =>
  decrypted.get(body);

const textOf = (
  value: Decrypted | null | undefined,
  body: null | string,
  fallback: string,
): null | string => {
  if (!body) return null;
  if (value === "error") return fallback;

  return value ? value.t : "…";
};

/**
 * The chat's messages with encrypted bodies (and quoted replies) replaced by
 * their text. A message that can't be decrypted gets `fallback` as its body.
 */
export const useDecryptedMessages = (
  items: ChatMessage[],
  key: CryptoKey | null,
  fallback: string,
): ChatMessage[] => {
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    if (!key) return;
    const pending = items.flatMap(item => [
      ...(item.encrypted && item.body && !decrypted.has(item.body)
        ? [item.body]
        : []),
      ...(item.replyTo?.encrypted &&
      item.replyTo.text &&
      !decrypted.has(item.replyTo.text)
        ? [item.replyTo.text]
        : []),
    ]);
    if (pending.length === 0) return;
    let cancelled = false;
    void Promise.all(pending.map(async body => decryptCached(key, body))).then(
      () => {
        if (!cancelled) setTick(tick => tick + 1);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [items, key]);

  return items.map(item => {
    if (!item.encrypted && !item.replyTo?.encrypted) return item;
    const own = item.encrypted && item.body ? decrypted.get(item.body) : null;
    const reply =
      item.replyTo?.encrypted && item.replyTo.text
        ? decrypted.get(item.replyTo.text)
        : null;

    return {
      ...item,
      body: item.encrypted ? textOf(own, item.body, fallback) : item.body,
      replyTo: item.replyTo
        ? {
            ...item.replyTo,
            text: item.replyTo.encrypted
              ? reply && reply !== "error"
                ? reply.t.slice(0, 100)
                : null
              : item.replyTo.text,
          }
        : null,
    };
  });
};
