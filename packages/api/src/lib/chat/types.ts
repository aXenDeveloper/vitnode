import type { ContentPublicPerson } from "@/content/public-person";

import type {
  ChatKind,
  ChatMemberStatus,
  ChatMessageKind,
  ChatSystemEvent,
} from "./const";
import type { ChatWrappedKey } from "./e2e";

/** One emoji on a message, as the viewer sees it. Browser-safe. */
export interface ChatReactionSummary {
  count: number;
  emoji: string;
  /** The viewer added this emoji. */
  reacted: boolean;
}

/** The quoted message a reply points at. */
export interface ChatReplyPreview {
  author: ContentPublicPerson | null;
  /** The original was deleted or hidden: no text. */
  deleted: boolean;
  /** `text` is the original's `ChatCipher` JSON; decrypt it in the browser. */
  encrypted: boolean;
  id: number;
  text: null | string;
}

/** One message as a member sees it. Browser-safe. */
export interface ChatMessage {
  author: ContentPublicPerson | null;
  /** `null` once deleted or hidden by a moderator. */
  body: null | string;
  chatId: number;
  clientId: null | string;
  createdAt: string;
  deleted: boolean;
  editedAt: null | string;
  /** `body` is a `ChatCipher` JSON string; decrypt it with the chat key. */
  encrypted: boolean;
  /** Hidden by a moderator. */
  hidden: boolean;
  id: number;
  kind: ChatMessageKind;
  reactions: ChatReactionSummary[];
  replyTo: ChatReplyPreview | null;
  /** Sent before the recipient accepted: links render as plain text. */
  sentAsRequest: boolean;
  system: ChatSystemEvent | null;
}

/** One row of the chat list. Browser-safe. */
export interface ChatListItem {
  /** End-to-end encrypted chat. */
  encrypted: boolean;
  id: number;
  /** Who added the viewer, for requests. */
  invitedBy: ContentPublicPerson | null;
  kind: ChatKind;
  lastMessage: null | {
    authorId: null | number;
    /** The author's name, for system lines such as "Anna left". */
    authorName: null | string;
    createdAt: string;
    /** `preview` is the message's `ChatCipher` JSON. */
    encrypted: boolean;
    id: number;
    /** Plain-text preview, `null` for a deleted message. */
    preview: null | string;
    system: ChatSystemEvent | null;
  };
  /** Up to 3 other members, for the avatar and the name. */
  members: ContentPublicPerson[];
  membersCount: number;
  muted: boolean;
  status: ChatMemberStatus;
  title: null | string;
  unread: boolean;
}

/** One member in the chat header. */
export interface ChatMember {
  /** Encrypted chats: the member holds the chat key for their current keys. */
  hasChatKey: boolean;
  isHost: boolean;
  /** Encrypted chats: the member's key version, `null` without a passcode. */
  keyVersion: null | number;
  /** `null` unless both sides share read receipts. */
  lastReadMessageId: null | number;
  /** Encrypted chats: raw P-256 public key, base64. */
  publicKey: null | string;
  status: ChatMemberStatus;
  user: ContentPublicPerson;
}

/** A chat's header and what the viewer may do in it. Browser-safe. */
export interface ChatDetails {
  createdAt: string;
  /** End-to-end encrypted chat. */
  encrypted: boolean;
  hostId: null | number;
  id: number;
  kind: ChatKind;
  lastMessageId: null | number;
  me: {
    /** I blocked the other member of a direct chat. */
    blockedOther: boolean;
    canInvite: boolean;
    canManage: boolean;
    /** May send messages now. */
    canWrite: boolean;
    /** Encrypted chats: the chat key wrapped for the viewer, if they hold one. */
    chatKey: null | { keyVersion: number; wrappedKey: ChatWrappedKey };
    invitedBy: ContentPublicPerson | null;
    lastReadMessageId: number;
    mutedUntil: null | string;
    /** Messages left before the request is accepted; `null` when not limited. */
    pendingMessagesLeft: null | number;
    status: ChatMemberStatus;
    /** The other member of a direct chat has not accepted yet. */
    waitingForAccept: boolean;
  };
  members: ChatMember[];
  membersCanInvite: boolean;
  membersCount: number;
  title: null | string;
}

/** The unread counts on the Chat button. Browser-safe. */
export interface ChatState {
  enabled: boolean;
  /** Members may start group chats (`chat.groups` in the API config). */
  groups: boolean;
  /** The WebSocket is mounted, so the browser may follow live updates. */
  live: boolean;
  /** The viewer's end-to-end encryption passcode. */
  passcode: {
    /** Their current key version, when set. */
    keyVersion: null | number;
    /** A role requires one: set it before chatting; new chats are encrypted. */
    required: boolean;
    set: boolean;
  };
  requests: number;
  unreadChats: number;
}
