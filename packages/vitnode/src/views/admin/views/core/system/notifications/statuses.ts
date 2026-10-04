export const NOTIFICATION_EVENT_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;
export type NotificationEventStatus =
  (typeof NOTIFICATION_EVENT_STATUSES)[number];

export const NOTIFICATION_DELIVERY_STATUSES = [
  "failed",
  "pending",
  "sending",
  "sent",
  "skipped",
] as const;
export type NotificationDeliveryStatus =
  (typeof NOTIFICATION_DELIVERY_STATUSES)[number];
