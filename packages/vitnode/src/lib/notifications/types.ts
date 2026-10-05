export const NOTIFICATION_EMAIL_MODES = [
  "none",
  "immediate",
  "daily",
  "weekly",
] as const;

export type NotificationEmailMode = (typeof NOTIFICATION_EMAIL_MODES)[number];

export type NotificationStateReason =
  | "archived"
  | "created"
  | "read"
  | "read_all"
  | "reconciled"
  | "removed"
  | "unread";

export interface NotificationState {
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
