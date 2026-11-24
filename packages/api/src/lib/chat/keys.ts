import type { Context } from "hono";

import { and, eq, inArray } from "drizzle-orm";

import type { ContentDatabase } from "@/content/server/service";

import {
  core_chat_conversation_keys,
  core_chat_user_keys,
} from "@/database/chat";

import type { ChatCipher, ChatKeyGrant, ChatWrappedPrivateKey } from "./e2e";

import { CHAT_E2E, zodChatCipher, zodCommitment } from "./e2e";

/** A member's public key and its version. */
export interface ChatPublicKeyInfo {
  keyVersion: number;
  publicKey: string;
}

/** Public keys of the `userIds` who set a chat passcode. */
export const loadPublicKeys = async (
  c: Context,
  userIds: readonly number[],
): Promise<Map<number, ChatPublicKeyInfo>> => {
  if (userIds.length === 0) return new Map();
  const rows = await c
    .get("db")
    .select({
      keyVersion: core_chat_user_keys.keyVersion,
      publicKey: core_chat_user_keys.publicKey,
      userId: core_chat_user_keys.userId,
    })
    .from(core_chat_user_keys)
    .where(inArray(core_chat_user_keys.userId, [...new Set(userIds)]));

  return new Map(
    rows.map(row => [
      row.userId,
      { keyVersion: row.keyVersion, publicKey: row.publicKey },
    ]),
  );
};

/** The member's own key row, wrapped private keys included. */
export const loadOwnKeys = async (c: Context, userId: number) => {
  const [row] = await c
    .get("db")
    .select()
    .from(core_chat_user_keys)
    .where(eq(core_chat_user_keys.userId, userId))
    .limit(1);

  return row ?? null;
};

export type SaveOwnKeysInput =
  | {
      /** New keys after a forgotten passcode: old encrypted chats need a re-share. */
      mode: "reset" | "setup";
      passcodeKey: ChatWrappedPrivateKey;
      publicKey: string;
      recoveryKey: ChatWrappedPrivateKey;
    }
  | {
      /** The same key pair under a new passcode and/or recovery key. */
      mode: "update";
      passcodeKey?: ChatWrappedPrivateKey;
      recoveryKey?: ChatWrappedPrivateKey;
    };

/** Why saving keys failed. */
export type SaveOwnKeysError = "already_set" | "not_set";

/**
 * Stores the member's keys. `setup` only when none exist, `update` re-wraps
 * the same pair, `reset` replaces it, bumps `keyVersion` and drops the chat
 * keys wrapped for the old one.
 */
export const saveOwnKeys = async (
  c: Context,
  userId: number,
  input: SaveOwnKeysInput,
): Promise<{ error: SaveOwnKeysError } | { keyVersion: number }> => {
  const existing = await loadOwnKeys(c, userId);
  const db = c.get("db");
  if (input.mode === "setup") {
    if (existing) return { error: "already_set" };
    await db.insert(core_chat_user_keys).values({
      passcodeKey: input.passcodeKey,
      publicKey: input.publicKey,
      recoveryKey: input.recoveryKey,
      userId,
    });

    return { keyVersion: 1 };
  }
  if (!existing) return { error: "not_set" };
  if (input.mode === "update") {
    await db
      .update(core_chat_user_keys)
      .set({
        passcodeKey: input.passcodeKey ?? existing.passcodeKey,
        recoveryKey: input.recoveryKey ?? existing.recoveryKey,
      })
      .where(eq(core_chat_user_keys.userId, userId));

    return { keyVersion: existing.keyVersion };
  }

  const keyVersion = existing.keyVersion + 1;
  await db.transaction(async (tx: ContentDatabase) => {
    await tx
      .update(core_chat_user_keys)
      .set({
        keyVersion,
        passcodeKey: input.passcodeKey,
        publicKey: input.publicKey,
        recoveryKey: input.recoveryKey,
      })
      .where(eq(core_chat_user_keys.userId, userId));
    await tx
      .delete(core_chat_conversation_keys)
      .where(eq(core_chat_conversation_keys.userId, userId));
  });

  return { keyVersion };
};

/**
 * Whether `grants` hold exactly one current key for each of `userIds`:
 * wrapped for the member's present `keyVersion`.
 */
export const grantsCover = (
  grants: readonly ChatKeyGrant[],
  userIds: readonly number[],
  keys: ReadonlyMap<number, ChatPublicKeyInfo>,
): boolean => {
  const byUser = new Map(grants.map(grant => [grant.userId, grant]));
  if (byUser.size !== grants.length) return false;

  return userIds.every(userId => {
    const grant = byUser.get(userId);
    const key = keys.get(userId);

    return !!grant && !!key && grant.keyVersion === key.keyVersion;
  });
};

/** Writes chat keys, replacing what a member had for this chat. */
export const storeGrants = async (
  tx: ContentDatabase,
  chatId: number,
  grants: readonly ChatKeyGrant[],
): Promise<void> => {
  for (const grant of grants) {
    const values = {
      keyVersion: grant.keyVersion,
      wrappedKey: grant.wrappedKey,
    };
    await tx
      .insert(core_chat_conversation_keys)
      .values({ ...values, conversationId: chatId, userId: grant.userId })
      .onConflictDoUpdate({
        set: values,
        target: [
          core_chat_conversation_keys.conversationId,
          core_chat_conversation_keys.userId,
        ],
      });
  }
};

/** Each member's stored chat key version for one chat. */
export const loadGrantVersions = async (
  c: Context,
  chatId: number,
): Promise<Map<number, number>> => {
  const rows = await c
    .get("db")
    .select({
      keyVersion: core_chat_conversation_keys.keyVersion,
      userId: core_chat_conversation_keys.userId,
    })
    .from(core_chat_conversation_keys)
    .where(eq(core_chat_conversation_keys.conversationId, chatId));

  return new Map(rows.map(row => [row.userId, row.keyVersion]));
};

/** The viewer's wrapped chat key, when it matches their current keys. */
export const loadOwnGrant = async (
  c: Context,
  chatId: number,
  userId: number,
) => {
  const [row] = await c
    .get("db")
    .select({
      keyVersion: core_chat_conversation_keys.keyVersion,
      wrappedKey: core_chat_conversation_keys.wrappedKey,
    })
    .from(core_chat_conversation_keys)
    .where(
      and(
        eq(core_chat_conversation_keys.conversationId, chatId),
        eq(core_chat_conversation_keys.userId, userId),
      ),
    )
    .limit(1);

  return row ?? null;
};

/** Parses an encrypted message body sent by a client. */
export const readCipherBody = (
  body: string,
  commitment: null | string | undefined,
): null | { body: string; commitment: string } => {
  let cipher: ChatCipher;
  try {
    const parsed = zodChatCipher.safeParse(JSON.parse(body));
    if (!parsed.success) return null;
    cipher = parsed.data;
  } catch {
    return null;
  }
  const checked = zodCommitment.safeParse(commitment);
  if (!checked.success) return null;

  return { body: JSON.stringify(cipher), commitment: checked.data };
};

const toHex = (bytes: ArrayBuffer): string =>
  [...new Uint8Array(bytes)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");

const fromBase64 = (value: string): null | Uint8Array<ArrayBuffer> => {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  } catch {
    return null;
  }
};

/**
 * Whether `text` is what was sent: HMAC-SHA-256(frankingKey, text) equals the
 * commitment stored with the message. Constant-time compare.
 */
export const verifyCommitment = async ({
  commitment,
  frankingKey,
  text,
}: {
  commitment: string;
  frankingKey: string;
  text: string;
}): Promise<boolean> => {
  const key = fromBase64(frankingKey);
  if (!key || key.length !== 32) return false;
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    key,
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const expected = toHex(
    await crypto.subtle.sign("HMAC", hmacKey, new TextEncoder().encode(text)),
  );
  if (expected.length !== commitment.length) return false;
  let diff = 0;
  for (let index = 0; index < expected.length; index++) {
    diff |= expected.charCodeAt(index) ^ commitment.charCodeAt(index);
  }

  return diff === 0;
};

export { CHAT_E2E };
