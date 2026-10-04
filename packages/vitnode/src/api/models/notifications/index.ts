import { and, eq, inArray } from "drizzle-orm";

import type { NotificationSubject } from "@/lib/notifications/types";

import { processQueueTasksByIds } from "@/api/modules/queue/helpers/process-queue-tasks";
import { core_notifications } from "@/database/notifications";

import type {
  PublishNotificationArgs,
  PublishNotificationResult,
} from "./publish";
import type { NotificationsContext } from "./shared";

import { getNotificationState, removeNotificationItems } from "./inbox";
import { publishNotification } from "./publish";

export type { PublishNotificationArgs, PublishNotificationResult };

export class NotificationsModel {
  constructor(c: NotificationsContext) {
    this.c = c;
  }

  protected readonly c: NotificationsContext;
  private readonly queued: number[] = [];

  flushAfterResponse(): void {
    const ids = this.queued.splice(0);
    if (ids.length === 0) return;

    void processQueueTasksByIds(this.c, ids).catch(async (error: unknown) => {
      await this.c
        .get("log")
        .warn(
          `[Notifications] Immediate delivery deferred to the queue: ${error instanceof Error ? error.message : String(error)}`,
        );
    });
  }

  async publish<TData>(
    args: PublishNotificationArgs<TData>,
  ): Promise<PublishNotificationResult> {
    return await publishNotification(this.c, args, queueId =>
      this.queued.push(queueId),
    );
  }

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
}
