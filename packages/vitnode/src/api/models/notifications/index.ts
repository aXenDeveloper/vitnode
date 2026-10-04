import { and, eq, inArray } from "drizzle-orm";

import type { NotificationSubject } from "@/lib/notifications/types";

import { core_notifications } from "@/database/notifications";

import type {
  PublishNotificationArgs,
  PublishNotificationResult,
} from "./publish";
import type { NotificationsContext } from "./shared";
import type { NotificationSubscriptionState } from "./subscriptions";

import { getNotificationState, removeNotificationItems } from "./inbox";
import { publishNotification } from "./publish";
import { runQueuedTasksNow } from "./run-now";
import { getSubscriptionState, setSubscriptionState } from "./subscriptions";

export type { PublishNotificationArgs, PublishNotificationResult };

/**
 * The Notifications Center on the API context: `c.get("notifications")`.
 * Plugins decide *who* might care; this decides who actually receives what,
 * and delivers it.
 */
export class NotificationsModel {
  constructor(c: NotificationsContext) {
    this.c = c;
  }

  protected readonly c: NotificationsContext;
  private readonly queued: number[] = [];

  /**
   * Starts delivering what this request published as soon as the response is
   * on its way, rather than on the next queue tick. Claims go through the
   * queue's own row locks, so this never double-processes; anything it cannot
   * claim (rolled back, already taken) is left to the worker.
   */
  flushAfterResponse(): void {
    const ids = this.queued.splice(0);
    if (ids.length === 0) return;

    void runQueuedTasksNow(this.c, ids).catch(async (error: unknown) => {
      await this.c
        .get("log")
        ?.warn(
          `[Notifications] Immediate delivery deferred to the queue: ${error instanceof Error ? error.message : String(error)}`,
        );
    });
  }

  async follow(userId: number, subject: NotificationSubject): Promise<void> {
    await setSubscriptionState(this.c, userId, subject, "following");
  }

  async mute(userId: number, subject: NotificationSubject): Promise<void> {
    await setSubscriptionState(this.c, userId, subject, "muted");
  }

  /**
   * Durably records an event and queues its delivery. With `tx` it joins the
   * producer's transaction, so a rolled-back write never notifies anyone and a
   * committed one always does, even if the process dies right after.
   *
   * @example
   * ```ts
   * await c.get("db").transaction(async tx => {
   *   const [comment] = await tx.insert(comments).values(values).returning();
   *   await c.get("notifications").publish({
   *     type: commentNotification,
   *     tx,
   *     recipients: [post.authorId],
   *     subject: { type: "blog.post", id: post.id },
   *     data: { postId: post.id, title: post.title },
   *     idempotencyKey: `comment:${comment.id}`,
   *   });
   * });
   * ```
   */
  async publish<TData>(
    args: PublishNotificationArgs<TData>,
  ): Promise<PublishNotificationResult> {
    return await publishNotification(this.c, args, queueId =>
      this.queued.push(queueId),
    );
  }

  /**
   * Removes inbox items about a subject - after the content is deleted or a
   * group of users lost access - keeping every owner's unread count right.
   * Narrow it with `type` and `userIds`; with neither, every recipient's item
   * about the subject goes.
   */
  async remove({
    subject,
    type,
    userIds,
  }: {
    subject: NotificationSubject;
    type?: string;
    userIds?: number[];
  }): Promise<number> {
    return await removeNotificationItems(this.c, {
      where: and(
        eq(core_notifications.subjectType, subject.type),
        eq(core_notifications.subjectId, String(subject.id)),
        type ? eq(core_notifications.type, type) : undefined,
        userIds ? inArray(core_notifications.userId, userIds) : undefined,
      ),
    });
  }

  async state(userId: number) {
    return await getNotificationState(this.c.get("db"), userId);
  }

  async subscription(
    userId: number,
    subject: NotificationSubject,
  ): Promise<NotificationSubscriptionState> {
    return await getSubscriptionState(this.c, userId, subject);
  }

  async unfollow(userId: number, subject: NotificationSubject): Promise<void> {
    if ((await this.subscription(userId, subject)) === "following") {
      await setSubscriptionState(this.c, userId, subject, "none");
    }
  }

  async unmute(userId: number, subject: NotificationSubject): Promise<void> {
    if ((await this.subscription(userId, subject)) === "muted") {
      await setSubscriptionState(this.c, userId, subject, "none");
    }
  }
}
