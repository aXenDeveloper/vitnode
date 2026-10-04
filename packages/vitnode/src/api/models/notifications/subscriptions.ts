import { and, asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type { NotificationSubject } from "@/lib/notifications/types";

import { core_notification_subscriptions } from "@/database/notifications";

import type { NotificationsContext } from "./shared";

import { getNotificationRegistry } from "./shared";

export type NotificationSubscriptionState = "following" | "muted" | "none";

const subjectWhere = (userId: number, subject: { id: string; type: string }) =>
  and(
    eq(core_notification_subscriptions.userId, userId),
    eq(core_notification_subscriptions.subjectType, subject.type),
    eq(core_notification_subscriptions.subjectId, subject.id),
  );

const normalize = (subject: NotificationSubject) => ({
  id: String(subject.id),
  type: subject.type,
});

export const getSubscriptionState = async (
  c: NotificationsContext,
  userId: number,
  subject: NotificationSubject,
): Promise<NotificationSubscriptionState> => {
  const [row] = await c
    .get("db")
    .select({ state: core_notification_subscriptions.state })
    .from(core_notification_subscriptions)
    .where(subjectWhere(userId, normalize(subject)))
    .limit(1);

  return row?.state ?? "none";
};

/**
 * Follows, mutes or clears one subject for one user. Following and muting are
 * one state, so muting a followed subject unfollows it and vice versa. Throws
 * a 400 for unknown subject types and a 403 when the plugin's `canFollow`
 * refuses.
 */
export const setSubscriptionState = async (
  c: NotificationsContext,
  userId: number,
  subject: NotificationSubject,
  state: NotificationSubscriptionState,
): Promise<NotificationSubscriptionState> => {
  const normalized = normalize(subject);
  const registered = getNotificationRegistry(c).getSubject(normalized.type);
  if (!registered || normalized.id.length === 0 || normalized.id.length > 100) {
    throw new HTTPException(400, { message: "Unknown notification subject." });
  }

  const db = c.get("db");
  if (state === "none") {
    await db
      .delete(core_notification_subscriptions)
      .where(subjectWhere(userId, normalized));

    return "none";
  }

  if (state === "following") {
    const { canFollow, followable } = registered.definition;
    if (followable === false) {
      throw new HTTPException(400, {
        message: "This subject cannot be followed.",
      });
    }
    if (canFollow && !(await canFollow({ c, id: normalized.id, userId }))) {
      throw new HTTPException(403);
    }
  }

  await db
    .insert(core_notification_subscriptions)
    .values({
      createdAt: new Date(),
      state,
      subjectId: normalized.id,
      subjectType: normalized.type,
      userId,
    })
    .onConflictDoUpdate({
      set: { createdAt: new Date(), state },
      target: [
        core_notification_subscriptions.userId,
        core_notification_subscriptions.subjectType,
        core_notification_subscriptions.subjectId,
      ],
    });

  return state;
};

export const listSubscriptions = async (
  c: NotificationsContext,
  {
    limit,
    state,
    userId,
  }: {
    limit: number;
    state?: "following" | "muted";
    userId: number;
  },
) =>
  await c
    .get("db")
    .select({
      createdAt: core_notification_subscriptions.createdAt,
      state: core_notification_subscriptions.state,
      subjectId: core_notification_subscriptions.subjectId,
      subjectType: core_notification_subscriptions.subjectType,
    })
    .from(core_notification_subscriptions)
    .where(
      and(
        eq(core_notification_subscriptions.userId, userId),
        state ? eq(core_notification_subscriptions.state, state) : undefined,
      ),
    )
    .orderBy(
      asc(core_notification_subscriptions.subjectType),
      asc(core_notification_subscriptions.subjectId),
    )
    .limit(limit);
