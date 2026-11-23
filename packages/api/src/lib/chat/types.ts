import type { ContentPublicPerson } from "@/content/public-person";

import type {
  ChatKind,
  ChatMemberStatus,
  ChatMessageKind,
  ChatSystemEvent,
} from "./const";

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
  id: number;
  /** Who added the viewer, for requests. */
  invitedBy: ContentPublicPerson | null;
  kind: ChatKind;
  lastMessage: null | {
    authorId: null | number;
    createdAt: string;
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
  isHost: boolean;
  /** `null` unless both sides share read receipts. */
  lastReadMessageId: null | number;
  status: ChatMemberStatus;
  user: ContentPublicPerson;
}

/** A chat's header and what the viewer may do in it. Browser-safe. */
export interface ChatDetails {
  createdAt: string;
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
  /** The WebSocket is mounted, so the browser may follow live updates. */
  live: boolean;
  requests: number;
  unreadChats: number;
}
