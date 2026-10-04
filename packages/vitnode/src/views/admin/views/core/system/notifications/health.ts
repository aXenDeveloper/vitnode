import type { AdminNotificationsOverview } from "./notifications-query";
import type {
  NotificationDeliveryStatus,
  NotificationEventStatus,
} from "./statuses";

import {
  NOTIFICATION_DELIVERY_STATUSES,
  NOTIFICATION_EVENT_STATUSES,
} from "./statuses";

export type NotificationEmailHealth = "disabled" | "missing" | "ready";
export type NotificationWorkerHealth = "active" | "inactive" | "stale";

export type NotificationHealthWarning =
  | { count: number; kind: "failed_deliveries" }
  | { count: number; kind: "failed_events" }
  | { kind: "cron_inactive" }
  | { kind: "cron_stale" }
  | { kind: "email_adapter_missing" };

export interface NotificationHealthSummary {
  deliveries: Record<NotificationDeliveryStatus, number>;
  email: NotificationEmailHealth;
  events: Record<NotificationEventStatus, number>;
  failedQueueTasks: number;
  warnings: NotificationHealthWarning[];
  worker: NotificationWorkerHealth;
}

/** Every known status with a count - the API leaves out statuses with no rows. */
const fillCounts = <S extends string>(
  statuses: readonly S[],
  counts: Record<string, number>,
): Record<S, number> =>
  Object.fromEntries(
    statuses.map(status => [status, counts[status] ?? 0]),
  ) as Record<S, number>;

/**
 * What the health cards and the warning banner show, derived from the
 * overview's raw aggregates. Warnings are ordered by how much they block:
 * nothing moves without cron, nothing is emailed without an adapter, and
 * failures come last because they are already recoverable from this screen.
 */
export const summarizeNotificationHealth = ({
  email,
  health,
}: Pick<
  AdminNotificationsOverview,
  "email" | "health"
>): NotificationHealthSummary => {
  const events = fillCounts(NOTIFICATION_EVENT_STATUSES, health.events);
  const deliveries = fillCounts(
    NOTIFICATION_DELIVERY_STATUSES,
    health.deliveries,
  );
  const failedQueueTasks = Object.entries(health.queue)
    .filter(([key]) => key.endsWith(":failed"))
    .reduce((total, [, count]) => total + count, 0);

  const worker: NotificationWorkerHealth = !health.cronActive
    ? "inactive"
    : health.cronStale
      ? "stale"
      : "active";
  const emailHealth: NotificationEmailHealth = !email.adapterConfigured
    ? "missing"
    : email.enabled
      ? "ready"
      : "disabled";

  const warnings: NotificationHealthWarning[] = [];
  if (worker === "inactive") warnings.push({ kind: "cron_inactive" });
  if (worker === "stale") warnings.push({ kind: "cron_stale" });
  if (emailHealth === "missing") {
    warnings.push({ kind: "email_adapter_missing" });
  }
  if (events.failed > 0) {
    warnings.push({ count: events.failed, kind: "failed_events" });
  }
  if (deliveries.failed > 0) {
    warnings.push({ count: deliveries.failed, kind: "failed_deliveries" });
  }

  return {
    deliveries,
    email: emailHealth,
    events,
    failedQueueTasks,
    warnings,
    worker,
  };
};
