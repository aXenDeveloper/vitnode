export const NOTIFICATION_EMAIL_MODES = [
  "none",
  "immediate",
  "daily",
  "weekly",
] as const;

export type NotificationEmailMode = (typeof NOTIFICATION_EMAIL_MODES)[number];

export const NOTIFICATION_CATEGORIES = [
  "account",
  "content",
  "social",
  "system",
] as const;

/** Why a user's unread state changed - sent with every realtime update. */
export type NotificationStateReason =
  | "archived"
  | "created"
  | "read"
  | "read_all"
  | "reconciled"
  | "removed"
  | "unread";

/** The canonical unread state of one user, as the server last committed it. */
export interface NotificationState {
  /**
   * Increases with every committed inbox change for the user. A client keeps
   * whichever state has the highest revision and drops anything older.
   */
  revision: number;
  unread: number;
}

export interface NotificationStateMessage extends NotificationState {
  notificationId?: number;
  reason: NotificationStateReason;
}

export interface NotificationSubject {
  id: number | string;
  type: string;
}

/** Day-of-week numbers as `Date#getUTCDay` returns them. */
export const NOTIFICATION_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
