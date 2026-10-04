// @vitest-environment node
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { z } from "zod";

import { buildNotificationType } from "@/api/lib/notifications/registry";
import {
  core_notification_user_state,
  core_notifications,
} from "@/database/notifications";
import {
  createNotificationsHarness,
  type NotificationsHarness,
} from "@/tests/notifications";
import { describePostgres } from "@/tests/postgres";

import { processNotificationEvent } from "./fanout";
import {
  archiveNotification,
  getNotificationState,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  reconcileNotificationCounts,
} from "./inbox";

const replyType = buildNotificationType({
  id: "test.reply",
  version: 1,
  schema: z.object({ threadId: z.number() }),
  category: "social",
  label: "test.reply.label",
  subjectType: "test.thread",
  defaults: { email: "none", inApp: true },
  grouping: { windowMinutes: 60 },
  present: ({ actorCount, eventCount }) => ({
    title: `${eventCount} replies from ${actorCount} people`,
    target: "/threads/1",
  }),
});

const pingType = buildNotificationType({
  id: "test.ping",
  version: 1,
  schema: z.object({ n: z.number() }),
  category: "system",
  label: "test.ping.label",
  defaults: { email: "none", inApp: true },
  present: ({ data }) => ({ title: `Ping ${data.n}` }),
});

let revokedUserIds = new Set<number>();
const privateType = buildNotificationType({
  id: "test.private",
  version: 1,
  schema: z.object({ secret: z.string() }),
  category: "content",
  label: "test.private.label",
  defaults: { email: "none", inApp: true },
  access: ({ userIds }) => userIds.filter(id => !revokedUserIds.has(id)),
  present: ({ data }) => ({
    title: `Secret: ${data.secret}`,
    target: "/secret",
  }),
});

describePostgres("notification inbox state", () => {
  let h: NotificationsHarness;
  let keySeq = 0;

  beforeAll(async () => {
    h = await createNotificationsHarness({
      types: [replyType, pingType, privateType],
    });
  });

  afterAll(async () => {
    await h?.database.drop();
  });

  const ping = async (userId: number, n = keySeq) => {
    keySeq += 1;
    await h.c.get("notifications").publish({
      actorId: null,
      data: { n },
      idempotencyKey: `ping-${keySeq}`,
      recipients: [userId],
      type: pingType,
    });
    await h.drainQueue();
  };

  const reply = async (userId: number, actorId: number) => {
    keySeq += 1;
    await h.c.get("notifications").publish({
      actorId,
      data: { threadId: 1 },
      idempotencyKey: `reply-${keySeq}`,
      recipients: [userId],
      subject: { id: 1, type: "test.thread" },
      type: replyType,
    });
    await h.drainQueue();
  };

  const state = async (userId: number) =>
    await getNotificationState(h.c.get("db"), userId);

  const itemsOf = async (userId: number) =>
    await h.c
      .get("db")
      .select()
      .from(core_notifications)
      .where(eq(core_notifications.userId, userId));

  it("counts read, unread and archive transitions exactly once", async () => {
    const [user] = await h.createUsers(1);
    await ping(user);
    const [item] = await itemsOf(user);
    expect((await state(user)).unread).toBe(1);

    const read = await markNotificationRead(h.c, {
      notificationId: item.id,
      userId: user,
    });
    expect(read.unread).toBe(0);

    const again = await markNotificationRead(h.c, {
      notificationId: item.id,
      userId: user,
    });
    expect(again.unread).toBe(0);

    expect(
      (
        await markNotificationUnread(h.c, {
          notificationId: item.id,
          userId: user,
        })
      ).unread,
    ).toBe(1);
    expect(
      (
        await markNotificationUnread(h.c, {
          notificationId: item.id,
          userId: user,
        })
      ).unread,
    ).toBe(1);

    expect(
      (
        await archiveNotification(h.c, {
          notificationId: item.id,
          userId: user,
        })
      ).unread,
    ).toBe(0);
    expect(await reconcileNotificationCounts(h.c, [user])).toEqual({
      checked: 1,
      corrected: 0,
    });
  });

  it("bumps the revision on every change and pushes the absolute count", async () => {
    const [user] = await h.createUsers(1);
    h.realtime.length = 0;

    await ping(user);
    await ping(user);
    const [item] = await itemsOf(user);
    await markNotificationRead(h.c, { notificationId: item.id, userId: user });

    const mine = h.realtime.filter(message => message.userId === user);
    expect(mine.map(message => message.data.unread)).toEqual([1, 2, 1]);
    expect(mine.map(message => message.data.revision)).toEqual([1, 2, 3]);
    expect(mine.map(message => message.data.reason)).toEqual([
      "created",
      "created",
      "read",
    ]);
  });

  it("keeps a group unread when activity arrived after the read boundary", async () => {
    const [owner, a, b] = await h.createUsers(3);
    await reply(owner, a);
    const [rendered] = await itemsOf(owner);

    await reply(owner, b);
    const after = await markNotificationRead(h.c, {
      notificationId: rendered.id,
      throughSeq: rendered.activitySeq,
      userId: owner,
    });

    expect(after.unread).toBe(1);
    const [item] = await itemsOf(owner);
    expect(item.eventCount).toBe(2);
    expect(item.readSeq).toBe(1);
    expect(item.activitySeq).toBe(2);

    await markNotificationRead(h.c, {
      notificationId: item.id,
      throughSeq: item.activitySeq,
      userId: owner,
    });
    expect((await state(owner)).unread).toBe(0);
    await reply(owner, a);
    expect((await state(owner)).unread).toBe(1);
    await reply(owner, b);
    expect((await state(owner)).unread).toBe(1);
  });

  it("brings an archived group back as unread on new activity", async () => {
    const [owner, actor] = await h.createUsers(2);
    await reply(owner, actor);
    const [item] = await itemsOf(owner);
    await archiveNotification(h.c, { notificationId: item.id, userId: owner });
    expect((await state(owner)).unread).toBe(0);

    await reply(owner, actor);
    const [reopened] = await itemsOf(owner);
    expect(reopened.archivedAt).toBeNull();
    expect((await state(owner)).unread).toBe(1);
  });

  it("starts a new item once the grouping window has passed", async () => {
    const [owner, actor] = await h.createUsers(2);
    await reply(owner, actor);
    await h.c
      .get("db")
      .update(core_notifications)
      .set({ groupBucket: sql`${core_notifications.groupBucket} - 2` })
      .where(eq(core_notifications.userId, owner));
    await reply(owner, actor);

    expect(await itemsOf(owner)).toHaveLength(2);
    expect((await state(owner)).unread).toBe(2);
  });

  it("marks all read at a lock boundary that later deliveries cannot cross", async () => {
    const [user] = await h.createUsers(1);
    await ping(user);
    await ping(user);

    const fanoutInProgress = h.forkContext();
    let releaseUserLock: () => void = () => undefined;
    const userLockHeld = new Promise<void>(resolve => {
      releaseUserLock = resolve;
    });
    const fanoutHoldingUserLock = fanoutInProgress
      .get("db")
      .transaction(async tx => {
        await tx
          .select()
          .from(core_notification_user_state)
          .where(eq(core_notification_user_state.userId, user))
          .for("update");
        await userLockHeld;
      });

    const markAll = markAllNotificationsRead(h.c, { userId: user });
    await new Promise(resolve => setTimeout(resolve, 100));
    releaseUserLock();
    await fanoutHoldingUserLock;
    const result = await markAll;

    expect(result.marked).toBe(2);
    expect(result.unread).toBe(0);

    await ping(user);
    expect((await state(user)).unread).toBe(1);
  });

  it("never loses or double-counts with concurrent deliveries and reads", async () => {
    const [user] = await h.createUsers(1);
    const forks = [h.forkContext(), h.forkContext(), h.forkContext()];

    const published = await Promise.all(
      Array.from(
        { length: 12 },
        async (_, index) =>
          await forks[index % forks.length].get("notifications").publish({
            actorId: null,
            data: { n: index },
            idempotencyKey: `concurrent-${user}-${index}`,
            recipients: [user],
            type: pingType,
          }),
      ),
    );

    await Promise.all(
      published.map(async ({ eventId }, index) => {
        await processNotificationEvent(forks[index % forks.length], eventId);
        if (index % 3 === 0) {
          const items = await itemsOf(user);
          const first = items.at(0);
          if (first) {
            await markNotificationRead(forks[(index + 1) % forks.length], {
              notificationId: first.id,
              userId: user,
            });
          }
        }
      }),
    );

    const items = await itemsOf(user);
    const actual = items.filter(
      item => item.archivedAt === null && item.readSeq < item.activitySeq,
    ).length;

    expect(items).toHaveLength(12);
    expect((await state(user)).unread).toBe(actual);
    expect(await reconcileNotificationCounts(h.c, [user])).toEqual({
      checked: 1,
      corrected: 0,
    });
  });

  it("isolates users and hides content after access is revoked", async () => {
    const [alice, bob] = await h.createUsers(2);
    await h.c.get("notifications").publish({
      actorId: null,
      data: { secret: "plans" },
      idempotencyKey: `private-${alice}`,
      recipients: [alice],
      type: privateType,
    });
    await h.drainQueue();
    const [item] = await itemsOf(alice);

    await expect(
      markNotificationRead(h.c, { notificationId: item.id, userId: bob }),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (await listNotifications(h.c, { limit: 20, userId: bob })).items,
    ).toEqual([]);

    const visible = await listNotifications(h.c, { limit: 20, userId: alice });
    expect(visible.items[0]).toMatchObject({
      available: true,
      target: "/secret",
      title: "Secret: plans",
    });

    revokedUserIds = new Set([alice]);
    const hidden = await listNotifications(h.c, { limit: 20, userId: alice });
    revokedUserIds = new Set();

    expect(hidden.items[0]).toMatchObject({
      actors: [],
      available: false,
      body: null,
      target: null,
      title: "This notification is no longer available.",
      unread: true,
    });
  });

  it("removes items for a subject and keeps counts right", async () => {
    const [owner, actor] = await h.createUsers(2);
    await reply(owner, actor);
    await ping(owner);
    expect((await state(owner)).unread).toBe(2);

    const removed = await h.c
      .get("notifications")
      .remove({ subject: { id: 1, type: "test.thread" }, userIds: [owner] });

    expect(removed).toBe(1);
    expect((await state(owner)).unread).toBe(1);
  });

  it("repairs a drifted count by reconciliation", async () => {
    const [user] = await h.createUsers(1);
    await ping(user);
    await h.c
      .get("db")
      .update(core_notification_user_state)
      .set({ unreadCount: 42 })
      .where(eq(core_notification_user_state.userId, user));

    expect(await reconcileNotificationCounts(h.c, [user])).toEqual({
      checked: 1,
      corrected: 1,
    });
    expect((await state(user)).unread).toBe(1);
  });

  it("paginates with a stable cursor and filters unread", async () => {
    const [user] = await h.createUsers(1);
    for (let index = 0; index < 5; index++) await ping(user, index);

    const first = await listNotifications(h.c, { limit: 2, userId: user });
    const second = await listNotifications(h.c, {
      cursor: first.nextCursor ?? undefined,
      limit: 2,
      userId: user,
    });
    const third = await listNotifications(h.c, {
      cursor: second.nextCursor ?? undefined,
      limit: 2,
      userId: user,
    });

    const ids = [...first.items, ...second.items, ...third.items].map(
      item => item.id,
    );
    expect(new Set(ids).size).toBe(5);
    expect(third.nextCursor).toBeNull();

    await markNotificationRead(h.c, {
      notificationId: first.items[0].id,
      userId: user,
    });
    const unread = await listNotifications(h.c, {
      limit: 20,
      unreadOnly: true,
      userId: user,
    });
    expect(unread.items).toHaveLength(4);
  });
});
