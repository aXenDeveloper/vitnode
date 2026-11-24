import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  camelCase,
  check,
  index,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";

import type {
  ChatKind,
  ChatMemberStatus,
  ChatMessageKind,
  ChatRequestOutcome,
  ChatSystemEvent,
} from "@/lib/chat/const";
import type { ChatWrappedKey, ChatWrappedPrivateKey } from "@/lib/chat/e2e";

import {
  CHAT_KINDS,
  CHAT_MEMBER_STATUSES,
  CHAT_MESSAGE_KINDS,
  CHAT_REQUEST_OUTCOMES,
} from "../lib/chat/const";
import { core_users } from "./users";

/** A direct chat between two members or a group chat. */
export const core_chat_conversations = camelCase.table.withRLS(
  "core_chat_conversations",
  t => ({
    id: t.serial().primaryKey(),
    kind: t
      .varchar({ enum: CHAT_KINDS, length: 16 })
      .$type<ChatKind>()
      .notNull(),
    /** `"<minUserId>:<maxUserId>"` for direct chats, `null` for groups. */
    directKey: t.varchar({ length: 32 }).unique(),
    title: t.varchar({ length: 100 }),
    hostId: t
      .integer()
      .references(() => core_users.id, { onDelete: "set null" }),
    membersCanInvite: t.boolean().notNull().default(true),
    /** End-to-end encrypted: bodies are ciphertext the server can't read. */
    encrypted: t.boolean().notNull().default(false),
    lastMessageId: t.bigint({ mode: "number" }),
    lastMessageAt: t.timestamp(),
    membersCount: t.integer().notNull().default(0),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    index("core_chat_conversations_last_message_at_idx").on(t.lastMessageAt),
  ],
);

/** A member of a chat, with their read cursor and personal settings. */
export const core_chat_participants = camelCase.table.withRLS(
  "core_chat_participants",
  t => ({
    conversationId: t
      .integer()
      .notNull()
      .references(() => core_chat_conversations.id, { onDelete: "cascade" }),
    userId: t
      .integer()
      .notNull()
      .references(() => core_users.id, { onDelete: "cascade" }),
    status: t
      .varchar({ enum: CHAT_MEMBER_STATUSES, length: 16 })
      .$type<ChatMemberStatus>()
      .notNull(),
    invitedById: t
      .integer()
      .references(() => core_users.id, { onDelete: "set null" }),
    invitedAt: t.timestamp().notNull().defaultNow(),
    acceptedAt: t.timestamp(),
    /** Set when the member left or was removed; the row stays for history. */
    leftAt: t.timestamp(),
    /** Messages before this id are not visible (the member joined later). */
    firstVisibleMessageId: t.bigint({ mode: "number" }).notNull().default(0),
    /** A hidden chat stays out of the list until a message newer than this. */
    hiddenUntilMessageId: t.bigint({ mode: "number" }),
    lastReadMessageId: t.bigint({ mode: "number" }).notNull().default(0),
    mutedUntil: t.timestamp(),
  }),
  t => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    index("core_chat_participants_list_idx").on(t.userId, t.leftAt, t.status),
  ],
);

/** One message, or a system line such as "Anna joined". */
export const core_chat_messages = camelCase.table.withRLS(
  "core_chat_messages",
  t => ({
    id: t.bigserial({ mode: "number" }).primaryKey(),
    conversationId: t
      .integer()
      .notNull()
      .references(() => core_chat_conversations.id, { onDelete: "cascade" }),
    authorId: t
      .integer()
      .references(() => core_users.id, { onDelete: "set null" }),
    kind: t
      .varchar({ enum: CHAT_MESSAGE_KINDS, length: 16 })
      .$type<ChatMessageKind>()
      .notNull(),
    body: t.text(),
    system: t.jsonb().$type<ChatSystemEvent>(),
    replyToMessageId: t
      .bigint({ mode: "number" })
      .references((): AnyPgColumn => core_chat_messages.id, {
        onDelete: "set null",
      }),
    /** The sender's id for an optimistic message; a retried send is a no-op. */
    clientId: t.varchar({ length: 64 }),
    /** Sent while the chat was a pending request: links render as text. */
    sentAsRequest: t.boolean().notNull().default(false),
    /** `body` is a `ChatCipher` JSON string (end-to-end encrypted chat). */
    encrypted: t.boolean().notNull().default(false),
    /** HMAC-SHA-256(frankingKey, text) in hex, for verifiable reports. */
    commitment: t.varchar({ length: 64 }),
    hiddenByModeratorAt: t.timestamp(),
    createdAt: t.timestamp().notNull().defaultNow(),
    editedAt: t.timestamp(),
    deletedAt: t.timestamp(),
  }),
  t => [
    index("core_chat_messages_page_idx").on(t.conversationId, t.id),
    index("core_chat_messages_author_idx").on(t.authorId),
    index("core_chat_messages_reply_idx").on(t.replyToMessageId),
    unique("core_chat_messages_client_key").on(t.authorId, t.clientId),
  ],
);

/** One member's emoji on one message. */
export const core_chat_message_reactions = camelCase.table.withRLS(
  "core_chat_message_reactions",
  t => ({
    messageId: t
      .bigint({ mode: "number" })
      .notNull()
      .references(() => core_chat_messages.id, { onDelete: "cascade" }),
    userId: t
      .integer()
      .notNull()
      .references(() => core_users.id, { onDelete: "cascade" }),
    emoji: t.varchar({ length: 32 }).notNull(),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    primaryKey({ columns: [t.messageId, t.userId, t.emoji] }),
    index("core_chat_message_reactions_user_idx").on(t.userId),
  ],
);

/** What became of each chat request; read by the spam throttle. */
export const core_chat_request_outcomes = camelCase.table.withRLS(
  "core_chat_request_outcomes",
  t => ({
    id: t.serial().primaryKey(),
    senderId: t
      .integer()
      .notNull()
      .references(() => core_users.id, { onDelete: "cascade" }),
    recipientId: t
      .integer()
      .references(() => core_users.id, { onDelete: "set null" }),
    outcome: t
      .varchar({ enum: CHAT_REQUEST_OUTCOMES, length: 16 })
      .$type<ChatRequestOutcome>()
      .notNull(),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    index("core_chat_request_outcomes_sender_idx").on(t.senderId, t.createdAt),
  ],
);

/** A member who blocked another. Generic: chat is its first reader. */
export const core_users_blocks = camelCase.table.withRLS(
  "core_users_blocks",
  t => ({
    userId: t
      .integer()
      .notNull()
      .references(() => core_users.id, { onDelete: "cascade" }),
    blockedUserId: t
      .integer()
      .notNull()
      .references(() => core_users.id, { onDelete: "cascade" }),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    primaryKey({ columns: [t.userId, t.blockedUserId] }),
    index("core_users_blocks_blocked_idx").on(t.blockedUserId),
    check("core_users_blocks_not_self", sql`${t.userId} <> ${t.blockedUserId}`),
  ],
);

/**
 * A member's end-to-end encryption keys. The private key is stored only
 * wrapped - under their passcode and under their recovery key.
 */
export const core_chat_user_keys = camelCase.table.withRLS(
  "core_chat_user_keys",
  t => ({
    userId: t
      .integer()
      .primaryKey()
      .references(() => core_users.id, { onDelete: "cascade" }),
    /** Raw uncompressed P-256 public key, base64. */
    publicKey: t.varchar({ length: 128 }).notNull(),
    passcodeKey: t.jsonb().$type<ChatWrappedPrivateKey>().notNull(),
    recoveryKey: t.jsonb().$type<ChatWrappedPrivateKey>().notNull(),
    /** Grows on every reset with new keys; chat keys name the one they used. */
    keyVersion: t.integer().notNull().default(1),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
);

/** An encrypted chat's key, wrapped for one member's public key. */
export const core_chat_conversation_keys = camelCase.table.withRLS(
  "core_chat_conversation_keys",
  t => ({
    conversationId: t
      .integer()
      .notNull()
      .references(() => core_chat_conversations.id, { onDelete: "cascade" }),
    userId: t
      .integer()
      .notNull()
      .references(() => core_users.id, { onDelete: "cascade" }),
    /** The member's `keyVersion` this was wrapped for. */
    keyVersion: t.integer().notNull(),
    wrappedKey: t.jsonb().$type<ChatWrappedKey>().notNull(),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    index("core_chat_conversation_keys_user_idx").on(t.userId),
  ],
);

/**
 * Text a reporter revealed from an encrypted message, checked against the
 * message's commitment. Read once by the report's snapshot, then pruned.
 */
export const core_chat_disclosures = camelCase.table.withRLS(
  "core_chat_disclosures",
  t => ({
    id: t.serial().primaryKey(),
    reportedMessageId: t
      .bigint({ mode: "number" })
      .notNull()
      .references(() => core_chat_messages.id, { onDelete: "cascade" }),
    messageId: t
      .bigint({ mode: "number" })
      .notNull()
      .references(() => core_chat_messages.id, { onDelete: "cascade" }),
    reporterId: t
      .integer()
      .notNull()
      .references(() => core_users.id, { onDelete: "cascade" }),
    text: t.text().notNull(),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    index("core_chat_disclosures_lookup_idx").on(
      t.reporterId,
      t.reportedMessageId,
    ),
  ],
);
