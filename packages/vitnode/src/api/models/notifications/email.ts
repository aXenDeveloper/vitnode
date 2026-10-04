import { and, asc, eq, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { createElement } from "react";

import type { NotificationTypePreference } from "@/database/notifications";
import type { NotificationEmailMode } from "@/lib/notifications/types";

import { latestEndedDigestPeriod } from "@/api/lib/notifications/digest-period";
import {
  NOTIFICATION_DIGEST_SCHEDULE,
  resolveNotificationChannels,
} from "@/api/lib/notifications/preferences";
import { sanitizeDeliveryError } from "@/api/lib/notifications/safe";
import { core_languages } from "@/database/languages";
import {
  core_notification_deliveries,
  core_notification_events,
  core_notification_receipts,
  core_notification_user_state,
  core_notifications,
} from "@/database/notifications";
import { core_users } from "@/database/users";
import NotificationEmailTemplate, {
  type NotificationEmailEntry,
} from "@/emails/notification";
import { getQueueBackoffDate } from "@/lib/api/get-queue-backoff-date";
import { CONFIG } from "@/lib/config";

import type { NotificationEventRow } from "./render";
import type {
  NotificationsContext,
  NotificationSettingsSnapshot,
} from "./shared";

import { dispatchEmailDrain } from "./email-queue";
import { valuesList } from "./fanout";
import {
  checkNotificationAccess,
  createTranslatorCache,
  loadActors,
  presentNotificationEmail,
  resolveEvent,
} from "./render";
import {
  getNotificationWorkers,
  isEmailConfigured,
  loadNotificationSettings,
} from "./shared";

type DeliveryRow = typeof core_notification_deliveries.$inferSelect;
type DeliveryOutcome =
  | { providerMessageId?: string; status: "sent" }
  | { reason: string; status: "skipped" };

const MAX_DIGEST_ENTRIES = 25;
const STALE_SENDING_MINUTES = 15;
const DIGEST_USERS_PER_PAGE = 200;
const DIGEST_MAX_USERS_PER_RUN = 5_000;

const absoluteUrl = (target: null | string): null | string =>
  target ? new URL(target, CONFIG.web).href : null;

const preferencesUrl = () =>
  new URL("/settings/notifications", CONFIG.web).href;

/** The email mode the user would get for this event right now. */
const currentEmailMode = ({
  c,
  event,
  preferences,
  settings,
}: {
  c: NotificationsContext;
  event: NotificationEventRow;
  preferences: Record<string, NotificationTypePreference>;
  settings: NotificationSettingsSnapshot;
}): NotificationEmailMode => {
  const resolved = resolveEvent(c, event);
  if (!resolved) return "none";

  return resolveNotificationChannels({
    definition: resolved.registered.definition,
    emailConfigured: isEmailConfigured(c),
    policy: settings.policies.get(event.type),
    preference: preferences[event.type],
  }).email;
};

interface ClaimedReceipt {
  createdAt: Date;
  event: NotificationEventRow;
  eventId: number;
  notificationId: null | number;
  seq: null | number;
}

/** Drops receipts from email for good, or hands them back to the planner. */
const settleReceipts = async (
  c: NotificationsContext,
  userId: number,
  { dropped, released }: { dropped: number[]; released: number[] },
) => {
  const db = c.get("db");
  if (dropped.length > 0) {
    await db
      .update(core_notification_receipts)
      .set({ emailPending: false })
      .where(
        and(
          eq(core_notification_receipts.userId, userId),
          inArray(core_notification_receipts.eventId, dropped),
        ),
      );
  }
  if (released.length > 0) {
    await db
      .update(core_notification_receipts)
      .set({ emailDeliveryId: null })
      .where(
        and(
          eq(core_notification_receipts.userId, userId),
          inArray(core_notification_receipts.eventId, released),
        ),
      );
  }
};

const isAlreadyRead = async (
  c: NotificationsContext,
  receipts: ClaimedReceipt[],
): Promise<Set<number>> => {
  const ids = receipts
    .map(receipt => receipt.notificationId)
    .filter(id => id !== null);
  if (ids.length === 0) return new Set();

  const items = await c
    .get("db")
    .select({
      archivedAt: core_notifications.archivedAt,
      id: core_notifications.id,
      readSeq: core_notifications.readSeq,
    })
    .from(core_notifications)
    .where(inArray(core_notifications.id, ids));
  const byId = new Map(items.map(item => [item.id, item]));

  return new Set(
    receipts
      .filter(receipt => {
        if (receipt.notificationId === null || receipt.seq === null) {
          return false;
        }
        const item = byId.get(receipt.notificationId);

        // Read past this event, archived, or removed: the user dealt with it.
        if (!item) return true;

        return item.archivedAt !== null || item.readSeq >= receipt.seq;
      })
      .map(receipt => receipt.eventId),
  );
};

/**
 * Re-checks every claimed receipt against current preferences, mutes, access
 * and read state, then renders what is left. Nothing is decided from the
 * state at fan-out time - a delayed email reflects the user's settings now.
 */
const deliverNotificationEmail = async (
  c: NotificationsContext,
  delivery: DeliveryRow,
  settings: NotificationSettingsSnapshot,
  translator: ReturnType<typeof createTranslatorCache>,
): Promise<DeliveryOutcome> => {
  const db = c.get("db");
  const [user] = await db
    .select({
      email: core_users.email,
      id: core_users.id,
      language: core_users.language,
      name: core_users.name,
      preferences: core_notification_user_state.preferences,
    })
    .from(core_users)
    .leftJoin(
      core_notification_user_state,
      eq(core_notification_user_state.userId, core_users.id),
    )
    .where(eq(core_users.id, delivery.userId))
    .limit(1);
  if (!user) return { reason: "user_missing", status: "skipped" };
  if (!isEmailConfigured(c)) {
    return { reason: "email_disabled", status: "skipped" };
  }

  const { locale, t } = await translator(user.language);
  const emailModel = c.get("email");
  const commonProps = {
    actionLabel: t("core.notifications.email.action"),
    preferencesLabel: t("core.notifications.email.preferences"),
    preferencesUrl: preferencesUrl(),
  };

  if (delivery.mode === "test") {
    const built = await emailModel.build({
      content: props =>
        createElement(NotificationEmailTemplate, {
          ...props,
          ...commonProps,
          entries: [
            {
              body: t("core.notifications.email.test_body"),
              title: t("core.notifications.email.test_title"),
              url: absoluteUrl("/notifications"),
            },
          ],
          heading: t("core.notifications.email.test_title"),
        }),
      locale,
      subject: t("core.notifications.email.test_subject"),
      to: user.email,
    });
    const sent = await emailModel.deliver(built, {
      idempotencyKey: `vitnode-notification-${delivery.idempotencyKey}`,
    });

    return { providerMessageId: sent.id, status: "sent" };
  }

  const claimed: ClaimedReceipt[] = (
    await db
      .select({
        createdAt: core_notification_receipts.createdAt,
        event: core_notification_events,
        eventId: core_notification_receipts.eventId,
        notificationId: core_notification_receipts.notificationId,
        seq: core_notification_receipts.seq,
      })
      .from(core_notification_receipts)
      .innerJoin(
        core_notification_events,
        eq(core_notification_events.id, core_notification_receipts.eventId),
      )
      .where(
        and(
          eq(core_notification_receipts.userId, user.id),
          eq(core_notification_receipts.emailDeliveryId, delivery.id),
          eq(core_notification_receipts.emailPending, true),
        ),
      )
      .orderBy(asc(core_notification_receipts.createdAt))
  ).reverse();

  if (claimed.length === 0) return { reason: "empty", status: "skipped" };

  const read = await isAlreadyRead(c, claimed);
  const preferences = user.preferences ?? {};
  const dropped: number[] = [];
  const released: number[] = [];
  const kept: { event: NotificationEventRow; receipt: ClaimedReceipt }[] = [];

  for (const receipt of claimed) {
    const mode = currentEmailMode({
      c,
      event: receipt.event,
      preferences,
      settings,
    });

    if (mode !== delivery.mode) {
      // The user switched modes since this was queued; the planner routes it.
      (mode === "none" ? dropped : released).push(receipt.eventId);
    } else if (read.has(receipt.eventId)) {
      dropped.push(receipt.eventId);
    } else {
      kept.push({ event: receipt.event, receipt });
    }
  }

  const actors = await loadActors(
    c,
    kept.map(entry => entry.event.actorId).filter(id => id !== null),
  );
  const entries: (NotificationEmailEntry & { subject: string })[] = [];

  for (const { event } of kept) {
    const resolved = resolveEvent(c, event);
    const allowed = resolved
      ? await checkNotificationAccess({
          c,
          data: resolved.data,
          event,
          registered: resolved.registered,
          userIds: [user.id],
        })
      : new Set<number>();
    const actor =
      event.actorId === null ? undefined : actors.get(event.actorId);
    const presented =
      resolved && allowed.has(user.id)
        ? presentNotificationEmail(c, {
            actors: { actorCount: actor ? 1 : 0, actors: actor ? [actor] : [] },
            data: resolved.data,
            event,
            eventCount: 1,
            locale,
            registered: resolved.registered,
            t,
          })
        : null;

    if (!presented) {
      dropped.push(event.id);
      continue;
    }

    entries.push({
      body: presented.body,
      subject: presented.subject,
      title: presented.title,
      url: absoluteUrl(presented.target),
    });
  }

  await settleReceipts(c, user.id, { dropped, released });
  if (entries.length === 0) return { reason: "empty", status: "skipped" };

  const first = entries[0];
  const isDigest = delivery.mode !== "immediate";
  const shown = entries.slice(0, MAX_DIGEST_ENTRIES);
  const subject = isDigest
    ? t(`core.notifications.email.digest_subject_${delivery.mode}`, {
        count: entries.length,
      })
    : first.subject;

  const built = await emailModel.build({
    content: props =>
      createElement(NotificationEmailTemplate, {
        ...props,
        ...commonProps,
        entries: shown,
        heading: isDigest
          ? t(`core.notifications.email.digest_heading_${delivery.mode}`)
          : first.title,
        intro:
          isDigest && entries.length > shown.length
            ? t("core.notifications.email.digest_more", {
                count: entries.length - shown.length,
              })
            : undefined,
      }),
    locale,
    subject,
    to: user.email,
  });

  // Same key on every attempt: a provider that deduplicates drops the second
  // send if the first was accepted but its answer never reached us.
  const sent = await emailModel.deliver(built, {
    idempotencyKey: `vitnode-notification-${delivery.idempotencyKey}`,
  });

  await db
    .update(core_notification_receipts)
    .set({ emailPending: false })
    .where(
      and(
        eq(core_notification_receipts.userId, user.id),
        eq(core_notification_receipts.emailDeliveryId, delivery.id),
      ),
    );
  await db
    .update(core_notification_deliveries)
    .set({ itemCount: entries.length })
    .where(eq(core_notification_deliveries.id, delivery.id));

  return { providerMessageId: sent.id, status: "sent" };
};

const runWithConcurrency = async <T>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<void>,
) => {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next];
        next += 1;
        await run(item);
      }
    }),
  );
};

/**
 * Sends up to `emailBatchSize` due deliveries, `emailConcurrency` at a time.
 * In-app delivery never waits on this: email runs in its own queue task, so a
 * slow or failing provider only delays email.
 */

export const drainNotificationEmails = async (
  c: NotificationsContext,
  { now = new Date() }: { now?: Date } = {},
): Promise<{
  claimed: number;
  failed: number;
  sent: number;
  skipped: number;
}> => {
  const db = c.get("db");
  const settings = await loadNotificationSettings(db);
  if (settings.global.paused) {
    return { claimed: 0, failed: 0, sent: 0, skipped: 0 };
  }

  const claimed = await db.transaction(async tx => {
    const due = await tx
      .select({ id: core_notification_deliveries.id })
      .from(core_notification_deliveries)
      .where(
        and(
          eq(core_notification_deliveries.status, "pending"),
          lte(core_notification_deliveries.availableAt, now),
        ),
      )
      .orderBy(
        asc(core_notification_deliveries.availableAt),
        asc(core_notification_deliveries.id),
      )
      .limit(getNotificationWorkers(c).emailBatchSize)
      .for("update", { skipLocked: true });
    if (due.length === 0) return [];

    return await tx
      .update(core_notification_deliveries)
      .set({
        attempts: sql`${core_notification_deliveries.attempts} + 1`,
        status: "sending",
        updatedAt: now,
      })
      .where(
        inArray(
          core_notification_deliveries.id,
          due.map(row => row.id),
        ),
      )
      .returning();
  });

  const stats = { claimed: claimed.length, failed: 0, sent: 0, skipped: 0 };
  const translator = createTranslatorCache(c);

  await runWithConcurrency(
    claimed,
    getNotificationWorkers(c).emailConcurrency,
    async delivery => {
      let patch: Partial<DeliveryRow>;
      try {
        const outcome = await deliverNotificationEmail(
          c,
          delivery,
          settings,
          translator,
        );
        patch =
          outcome.status === "sent"
            ? {
                lastError: null,
                providerMessageId: outcome.providerMessageId ?? null,
                sentAt: new Date(),
                status: "sent",
              }
            : { skipReason: outcome.reason, status: "skipped" };
        stats[outcome.status === "sent" ? "sent" : "skipped"] += 1;
      } catch (error) {
        const lastError = sanitizeDeliveryError(error);
        const exhausted = delivery.attempts >= delivery.maxAttempts;
        patch = exhausted
          ? { lastError, status: "failed" }
          : {
              availableAt: getQueueBackoffDate(delivery.attempts),
              lastError,
              status: "pending",
            };
        if (exhausted) stats.failed += 1;
        await c
          .get("log")
          ?.warn(
            `[Notifications] Email delivery ${delivery.id} failed (attempt ${delivery.attempts}/${delivery.maxAttempts}): ${lastError}`,
          );
      }

      await db
        .update(core_notification_deliveries)
        .set({ ...patch, updatedAt: new Date() })
        .where(
          and(
            eq(core_notification_deliveries.id, delivery.id),
            eq(core_notification_deliveries.status, "sending"),
          ),
        );
    },
  );

  const [next] = await db
    .select({ availableAt: core_notification_deliveries.availableAt })
    .from(core_notification_deliveries)
    .where(eq(core_notification_deliveries.status, "pending"))
    .orderBy(asc(core_notification_deliveries.availableAt))
    .limit(1);
  if (next) {
    await dispatchEmailDrain(
      c,
      undefined,
      next.availableAt > now ? next.availableAt : undefined,
    );
  }

  return stats;
};

/**
 * A worker that died mid-send leaves a delivery in `sending`. After a grace
 * period it goes back to `pending`. The provider may already have accepted the
 * message - with an idempotency-capable provider the retry is dropped, with
 * plain SMTP it can arrive twice. That window is the one unavoidable
 * uncertainty; nothing here claims exactly-once email.
 */
export const reclaimStaleDeliveries = async (
  c: NotificationsContext,
  now = new Date(),
): Promise<number> => {
  const rows = await c
    .get("db")
    .update(core_notification_deliveries)
    .set({ availableAt: now, status: "pending", updatedAt: now })
    .where(
      and(
        eq(core_notification_deliveries.status, "sending"),
        lt(
          core_notification_deliveries.updatedAt,
          new Date(now.getTime() - STALE_SENDING_MINUTES * 60_000),
        ),
      ),
    )
    .returning({ id: core_notification_deliveries.id });

  return rows.length;
};

interface PlannedDelivery {
  eventIds: number[];
  idempotencyKey: string;
  mode: "daily" | "immediate" | "weekly";
  periodEnd?: Date;
  periodStart?: Date;
  userId: number;
}

/**
 * Turns pending email receipts into deliveries: one digest per user and
 * period, or an immediate email for receipts whose user switched to immediate.
 * A digest delivery's key is the user, mode and local date of its period, so a
 * period is claimed once however often this runs; receipts it claimed are
 * never offered to another digest.
 */
export const planNotificationDigests = async (
  c: NotificationsContext,
  { now = new Date() }: { now?: Date } = {},
): Promise<{ deliveries: number; users: number }> => {
  const db = c.get("db");
  const settings = await loadNotificationSettings(db);
  let cursor = 0;
  let users = 0;
  let created = 0;

  while (users < DIGEST_MAX_USERS_PER_RUN) {
    const page = await db
      .selectDistinct({ userId: core_notification_receipts.userId })
      .from(core_notification_receipts)
      .where(
        and(
          eq(core_notification_receipts.emailPending, true),
          isNull(core_notification_receipts.emailDeliveryId),
          sql`${core_notification_receipts.userId} > ${cursor}`,
        ),
      )
      .orderBy(asc(core_notification_receipts.userId))
      .limit(DIGEST_USERS_PER_PAGE);
    if (page.length === 0) break;

    const userIds = page.map(row => row.userId);
    cursor = userIds.at(-1) ?? cursor;
    users += userIds.length;

    const [profiles, receipts] = await Promise.all([
      db
        .select({
          languageTimeZone: core_languages.timezone,
          preferences: core_notification_user_state.preferences,
          timeZone: core_users.timeZone,
          userId: core_users.id,
        })
        .from(core_users)
        .leftJoin(
          core_notification_user_state,
          eq(core_notification_user_state.userId, core_users.id),
        )
        .leftJoin(core_languages, eq(core_languages.code, core_users.language))
        .where(inArray(core_users.id, userIds)),
      db
        .select({
          createdAt: core_notification_receipts.createdAt,
          event: core_notification_events,
          userId: core_notification_receipts.userId,
        })
        .from(core_notification_receipts)
        .innerJoin(
          core_notification_events,
          eq(core_notification_events.id, core_notification_receipts.eventId),
        )
        .where(
          and(
            inArray(core_notification_receipts.userId, userIds),
            eq(core_notification_receipts.emailPending, true),
            isNull(core_notification_receipts.emailDeliveryId),
          ),
        ),
    ]);

    const profileOf = new Map(profiles.map(row => [row.userId, row]));
    const plans = new Map<string, PlannedDelivery>();
    const dropped: { eventId: number; userId: number }[] = [];

    for (const receipt of receipts) {
      const profile = profileOf.get(receipt.userId);
      const mode = profile
        ? currentEmailMode({
            c,
            event: receipt.event,
            preferences: profile.preferences ?? {},
            settings,
          })
        : "none";

      if (mode === "none" || !profile) {
        dropped.push({ eventId: receipt.event.id, userId: receipt.userId });
        continue;
      }

      if (mode === "immediate") {
        const key = `immediate:${receipt.event.id}:${receipt.userId}`;
        plans.set(key, {
          eventIds: [receipt.event.id],
          idempotencyKey: key,
          mode,
          userId: receipt.userId,
        });
        continue;
      }

      const period = latestEndedDigestPeriod({
        hour: NOTIFICATION_DIGEST_SCHEDULE.hour,
        mode,
        now,
        timeZone: profile.timeZone ?? profile.languageTimeZone ?? "UTC",
        weekday: NOTIFICATION_DIGEST_SCHEDULE.weekday,
      });
      // Not due yet: it belongs to the period still running.
      if (receipt.createdAt >= period.end) continue;

      const key = `${mode}:${receipt.userId}:${period.key}`;
      const plan = plans.get(key) ?? {
        eventIds: [],
        idempotencyKey: key,
        mode,
        periodEnd: period.end,
        periodStart: period.start,
        userId: receipt.userId,
      };
      plan.eventIds.push(receipt.event.id);
      plans.set(key, plan);
    }

    created += await db.transaction(async tx => {
      if (dropped.length > 0) {
        await tx.execute(sql`
          UPDATE ${core_notification_receipts} AS r SET "emailPending" = false
          FROM (VALUES ${valuesList(
            dropped.map(row => [
              sql`${row.eventId}::bigint`,
              sql`${row.userId}::integer`,
            ]),
          )}) AS v(eid, uid)
          WHERE r."eventId" = v.eid AND r."userId" = v.uid
        `);
      }

      const list = [...plans.values()];
      if (list.length === 0) return 0;

      const inserted = await tx
        .insert(core_notification_deliveries)
        .values(
          list.map(plan => ({
            availableAt: now,
            channel: "email" as const,
            createdAt: now,
            eventId: plan.mode === "immediate" ? plan.eventIds[0] : null,
            idempotencyKey: plan.idempotencyKey,
            mode: plan.mode,
            periodEnd: plan.periodEnd ?? null,
            periodStart: plan.periodStart ?? null,
            updatedAt: now,
            userId: plan.userId,
          })),
        )
        .onConflictDoNothing()
        .returning({
          id: core_notification_deliveries.id,
          idempotencyKey: core_notification_deliveries.idempotencyKey,
        });

      const claims = inserted.flatMap(row => {
        const plan = plans.get(row.idempotencyKey);

        return (plan?.eventIds ?? []).map(eventId => [
          sql`${eventId}::bigint`,
          sql`${plan?.userId ?? 0}::integer`,
          sql`${row.id}::bigint`,
        ]);
      });

      if (claims.length > 0) {
        // `IS NULL` guards against a concurrent planner having claimed first.
        await tx.execute(sql`
          UPDATE ${core_notification_receipts} AS r SET "emailDeliveryId" = v.did
          FROM (VALUES ${valuesList(claims)}) AS v(eid, uid, did)
          WHERE r."eventId" = v.eid AND r."userId" = v.uid
            AND r."emailDeliveryId" IS NULL
        `);
      }

      // An immediate delivery that already existed means this event already
      // had its one immediate email; it is not sent again.
      const conflicted = list.filter(
        plan =>
          plan.mode === "immediate" &&
          !inserted.some(row => row.idempotencyKey === plan.idempotencyKey),
      );
      if (conflicted.length > 0) {
        await tx.execute(sql`
          UPDATE ${core_notification_receipts} AS r SET "emailPending" = false
          FROM (VALUES ${valuesList(
            conflicted.map(plan => [
              sql`${plan.eventIds[0]}::bigint`,
              sql`${plan.userId}::integer`,
            ]),
          )}) AS v(eid, uid)
          WHERE r."eventId" = v.eid AND r."userId" = v.uid
        `);
      }

      if (inserted.length > 0) await dispatchEmailDrain(c, tx);

      return inserted.length;
    });
  }

  return { deliveries: created, users };
};
