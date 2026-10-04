// @vitest-environment node
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { z } from "zod";

import { buildNotificationType } from "@/api/lib/notifications/registry";
import {
  core_notification_events,
  core_notification_receipts,
  core_notification_user_state,
  core_notifications,
} from "@/database/notifications";
import { core_queue } from "@/database/queue";
import {
  createNotificationsHarness,
  type NotificationsHarness,
} from "@/tests/notifications";
import { describePostgres } from "@/tests/postgres";

import { processNotificationEvent } from "./fanout";
import { getNotificationState } from "./inbox";

const commentType = buildNotificationType({
  id: "test.comment",
  version: 1,
  schema: z.object({ postId: z.number(), title: z.string() }),
  category: "social",
  label: "test.comment.label",
  subjectType: "test.post",
  defaults: { email: "none", inApp: true },
  grouping: { windowMinutes: 60 },
  present: ({ actorCount, actors, data }) => ({
    title: `${actors[0]?.name ?? "Someone"} and ${actorCount - 1} others commented on ${data.title}`,
    target: `/posts/${data.postId}`,
  }),
});

const secretType = buildNotificationType({
  id: "test.secret",
  version: 1,
  schema: z.object({ allowed: z.array(z.number()) }),
  category: "content",
  label: "test.secret.label",
  defaults: { email: "none", inApp: true },
  access: ({ data, userIds }) =>
    userIds.filter(id => data.allowed.includes(id)),
  present: () => ({ title: "Secret", target: "https://evil.example/steal" }),
});

describePostgres("notification fan-out", () => {
  let h: NotificationsHarness;

  beforeAll(async () => {
    h = await createNotificationsHarness({ types: [commentType, secretType] });
  });

  afterAll(async () => {
    await h?.database.drop();
  });

  const unreadOf = async (userId: number) =>
    (await getNotificationState(h.c.get("db"), userId)).unread;

  it("rejects unregistered types and invalid payloads", async () => {
    await expect(
      h.c.get("notifications").publish({
        data: {},
        idempotencyKey: "x",
        recipients: [1],
        type: "test.missing",
      }),
    ).rejects.toThrow(/not registered/);

    await expect(
      h.c.get("notifications").publish({
        data: { postId: "nope" as unknown as number, title: "t" },
        idempotencyKey: "x",
        recipients: [1],
        type: commentType,
      }),
    ).rejects.toThrow(/Invalid data/);
  });

  it("rolls back with the producer's transaction", async () => {
    const [user] = await h.createUsers(1);

    await expect(
      h.c.get("db").transaction(async tx => {
        await h.c.get("notifications").publish({
          data: { postId: 1, title: "Rolled back" },
          idempotencyKey: "rollback-1",
          recipients: [user],
          subject: { id: 1, type: "test.post" },
          tx,
          type: commentType,
        });
        throw new Error("producer failed");
      }),
    ).rejects.toThrow("producer failed");

    const events = await h.c
      .get("db")
      .select()
      .from(core_notification_events)
      .where(eq(core_notification_events.idempotencyKey, "rollback-1"));
    const tasks = await h.c
      .get("db")
      .select()
      .from(core_queue)
      .where(sql`${core_queue.payload}->>'eventId' IS NOT NULL`);

    expect(events).toHaveLength(0);
    expect(tasks.filter(task => task.status === "pending")).toHaveLength(0);
  });

  it("commits durably with the producer and delivers once, skipping the actor", async () => {
    const [actor, a, b] = await h.createUsers(3);

    const first = await h.c.get("db").transaction(
      async tx =>
        await h.c.get("notifications").publish({
          actorId: actor,
          data: { postId: 7, title: "Seven" },
          idempotencyKey: "comment-71",
          recipients: [a, b, b, actor],
          subject: { id: 7, type: "test.post" },
          tx,
          type: commentType,
        }),
    );
    const again = await h.c.get("notifications").publish({
      actorId: actor,
      data: { postId: 7, title: "Seven" },
      idempotencyKey: "comment-71",
      recipients: [a, b],
      subject: { id: 7, type: "test.post" },
      type: commentType,
    });

    expect(again).toEqual({ duplicate: true, eventId: first.eventId });

    await h.drainQueue();
    await processNotificationEvent(h.c, first.eventId);

    expect(await unreadOf(a)).toBe(1);
    expect(await unreadOf(b)).toBe(1);
    expect(await unreadOf(actor)).toBe(0);

    const receipts = await h.c
      .get("db")
      .select()
      .from(core_notification_receipts)
      .where(eq(core_notification_receipts.eventId, first.eventId));
    const byId = (x: number, y: number) => x - y;
    expect(receipts.map(row => row.userId).sort(byId)).toEqual(
      [a, b].sort(byId),
    );
  });

  it("replays a crashed batch without duplicating anything", async () => {
    const [actor, a] = await h.createUsers(2);
    const { eventId } = await h.c.get("notifications").publish({
      actorId: actor,
      data: { postId: 8, title: "Eight" },
      idempotencyKey: "comment-81",
      recipients: [a],
      subject: { id: 8, type: "test.post" },
      type: commentType,
    });
    await h.drainQueue();

    await h.c
      .get("db")
      .update(core_notification_events)
      .set({ recipientCursor: 0, status: "processing" })
      .where(eq(core_notification_events.id, eventId));
    await processNotificationEvent(h.c, eventId);

    const [item] = await h.c
      .get("db")
      .select()
      .from(core_notifications)
      .where(eq(core_notifications.userId, a));

    expect(item?.eventCount).toBe(1);
    expect(await unreadOf(a)).toBe(1);
  });

  it("groups events and re-opens a read group exactly once", async () => {
    const [x, y, owner] = await h.createUsers(3);
    const publish = async (actorId: number, key: string) =>
      await h.c.get("notifications").publish({
        actorId,
        data: { postId: 9, title: "Nine" },
        idempotencyKey: key,
        recipients: [owner],
        subject: { id: 9, type: "test.post" },
        type: commentType,
      });

    await publish(x, "c-9-1");
    await publish(y, "c-9-2");
    await h.drainQueue();

    const items = await h.c
      .get("db")
      .select()
      .from(core_notifications)
      .where(eq(core_notifications.userId, owner));
    expect(items).toHaveLength(1);
    expect(items[0]?.eventCount).toBe(2);
    expect(await unreadOf(owner)).toBe(1);

    await h.c
      .get("db")
      .update(core_notifications)
      .set({ readSeq: sql`${core_notifications.activitySeq}` })
      .where(eq(core_notifications.userId, owner));
    await h.c
      .get("db")
      .update(core_notification_user_state)
      .set({ unreadCount: 0 })
      .where(eq(core_notification_user_state.userId, owner));

    await publish(x, "c-9-3");
    await h.drainQueue();

    expect(await unreadOf(owner)).toBe(1);
  });

  it("checks access per batch and never sends unsafe targets", async () => {
    const [allowed, denied] = await h.createUsers(2);
    await h.c.get("notifications").publish({
      actorId: null,
      data: { allowed: [allowed] },
      idempotencyKey: "secret-1",
      recipients: [allowed, denied],
      type: secretType,
    });
    await h.drainQueue();

    const rows = await h.c
      .get("db")
      .select({ userId: core_notifications.userId })
      .from(core_notifications)
      .where(and(eq(core_notifications.type, "test.secret")));

    expect(rows.map(row => row.userId)).toEqual([allowed]);
  });
});
