/** Kinds of chat. A direct chat always has exactly two members. Browser-safe. */
export const CHAT_KINDS = ["direct", "group"] as const;
export type ChatKind = (typeof CHAT_KINDS)[number];

/** A member's place in a chat: `pending` is a chat request not accepted yet. */
export const CHAT_MEMBER_STATUSES = ["pending", "accepted"] as const;
export type ChatMemberStatus = (typeof CHAT_MEMBER_STATUSES)[number];

/** Who may send a member chat requests. */
export const CHAT_REQUESTS_FROM = [
  "everyone",
  "established",
  "nobody",
] as const;
export type ChatRequestsFrom = (typeof CHAT_REQUESTS_FROM)[number];

export const CHAT_MESSAGE_KINDS = ["message", "system"] as const;
export type ChatMessageKind = (typeof CHAT_MESSAGE_KINDS)[number];

/** What happened to a chat request, kept for the spam throttle. */
export const CHAT_REQUEST_OUTCOMES = [
  "accepted",
  "ignored",
  "blocked",
] as const;
export type ChatRequestOutcome = (typeof CHAT_REQUEST_OUTCOMES)[number];

/** Events a system message records. */
export type ChatSystemEvent =
  | { title: null | string; type: "renamed" }
  | { type: "created" }
  | { type: "joined"; userIds: number[] }
  | { type: "left" }
  | { type: "removed"; userId: number };

/** Limits shared by the API and the UI. Browser-safe. */
export const CHAT_LIMITS = {
  /** Messages a sender may send before the recipient accepts the request. */
  pendingMessages: 3,
  /** Characters in one message. */
  messageMaxLength: 4000,
  /** Characters in a group title. */
  titleMaxLength: 100,
  /** Messages one page returns by default and at most. */
  pageSize: 50,
  pageMaxSize: 100,
  /** Chats one list page returns. */
  listPageSize: 30,
  /** Distinct emoji on one message. */
  reactionsPerMessage: 20,
  /** Members of a group, the creator included. */
  maxGroupSize: 100,
  /** Minutes the author may edit a message for. */
  editWindowMinutes: 15,
  /** Accounts younger than this many days are not `established`. */
  establishedAccountDays: 30,
  /** Blocks one member may keep. */
  maxBlocks: 1000,
  /** Request throttle: requests in the window before it may trip. */
  throttleMinRequests: 10,
  /** Request throttle: share of ignored or blocked requests that trips it. */
  throttleRatio: 0.7,
  throttleWindowDays: 7,
  throttlePauseHours: 24,
  /** Minutes a message waits before its email notification goes out. */
  notifyDelayMinutes: 2,
  /** Characters of a message shown in the chat list. */
  previewLength: 100,
  /** Characters of a quoted message in a reply. */
  replyPreviewLength: 100,
  /** Minimum seconds between two typing signals the server relays. */
  typingThrottleSeconds: 3,
  /** Seconds a typing indicator stays without a new signal. */
  typingExpireSeconds: 6,
} as const;

/** Builds the unique key of a direct chat between two members. */
export const chatDirectKey = (a: number, b: number): string =>
  a < b ? `${a}:${b}` : `${b}:${a}`;

/** Install-wide chat settings, `chat` in the API config with defaults applied. */
export interface ChatSettings {
  /** Minutes the author may edit a message for; `0` turns editing off. */
  editWindowMinutes: number;
  /** `false` hides chat and answers `404` on every chat route. */
  enabled: boolean;
  /** Accounts younger than this many days count as not `established`. */
  establishedAccountDays: number;
  /** Members of a group, the creator included. */
  maxGroupSize: number;
}

const wholeNumber = (
  value: unknown,
  { fallback, max, min }: { fallback: number; max: number; min: number },
): number =>
  typeof value === "number" && Number.isSafeInteger(value)
    ? Math.min(Math.max(value, min), max)
    : fallback;

/** Applies defaults and bounds to the `chat` block of the API config. */
export const resolveChatSettings = (
  config: Partial<ChatSettings> | undefined,
): ChatSettings => ({
  editWindowMinutes: wholeNumber(config?.editWindowMinutes, {
    fallback: CHAT_LIMITS.editWindowMinutes,
    max: 60 * 24 * 365,
    min: 0,
  }),
  enabled: config?.enabled ?? true,
  establishedAccountDays: wholeNumber(config?.establishedAccountDays, {
    fallback: CHAT_LIMITS.establishedAccountDays,
    max: 3650,
    min: 0,
  }),
  maxGroupSize: wholeNumber(config?.maxGroupSize, {
    fallback: CHAT_LIMITS.maxGroupSize,
    max: 200,
    min: 2,
  }),
});
