// @vitest-environment node
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { z } from "zod";

import { buildNotificationType } from "@/api/lib/notifications/registry";
import {
  core_notification_deliveries,
  core_notification_receipts,
  core_notifications,
} from "@/database/notifications";
import { core_users } from "@/database/users";
import {
  createNotificationsHarness,
  type NotificationsHarness,
} from "@/tests/notifications";
import { describePostgres } from "@/tests/postgres";

import { drainNotificationEmails, planNotificationDigests } from "./email";
import { markNotificationRead } from "./inbox";
import { updateNotificationPreferences } from "./preferences";

const alertType = buildNotificationType({
  id: "test.alert",
  version: 1,
  schema: z.object({ text: z.string() }),
  category: "account",
  label: "test.alert.label",
  defaults: { email: "immediate", inApp: true },
  email: true,
  present: ({ data }) => ({ title: `Alert: ${data.text}`, target: "/alerts" }),
});

const newsType = buildNotificationType({
  id: "test.news",
  version: 1,
  schema: z.object({ headline: z.string() }),
  category: "content",
  label: "test.news.label",
  defaults: { email: "daily", inApp: true },
  email: true,
  present: ({ data }) => ({ title: data.headline, target: "/news" }),
});

describePostgres("notification email", () => {
  let h: NotificationsHarness;
  let seq = 0;

  beforeAll(async () => {
    h = await createNotificationsHarness({ types: [alertType, newsType] });
  });

  afterAll(async () => {
    await h?.database.drop();
  });

  const publish = async (
    type: typeof alertType | typeof newsType,
    userId: number,
    text: string,
  ) => {
    seq += 1;
    const data = type === alertType ? { text } : { headline: text };
    const result = await h.c.get("notifications").publish({
      actorId: null,
      data: data,
      idempotencyKey: `email-${seq}`,
      recipients: [userId],
      type: type as never,
    });

    return result.eventId;
  };

  const deliveriesOf = async (userId: number) =>
    await h.c
      .get("db")
      .select()
      .from(core_notification_deliveries)
      .where(eq(core_notification_deliveries.userId, userId));

  const sentTo = (userId: number) =>
    h.sentEmails.filter(email => email.to === `user${userId}@example.com`);

  it("sends one immediate email through the queue, with a stable idempotency key", async () => {
    const [user] = await h.createUsers(1);
    const eventId = await publish(alertType, user, "login from a new device");
    await h.drainQueue();
    await drainNotificationEmails(h.c);

    const emails = sentTo(user);
    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({
      idempotencyKey: `vitnode-notification-immediate:${eventId}:${user}`,
      subject: "Alert: login from a new device",
    });
    expect(emails[0].entries[0]?.url).toMatch(/\/alerts$/);

    const [delivery] = await deliveriesOf(user);
    expect(delivery).toMatchObject({
      attempts: 1,
      providerMessageId: "message-1",
      status: "sent",
    });
  });

  it("retries a provider failure with backoff and never sends twice", async () => {
    const [user] = await h.createUsers(1);
    await publish(alertType, user, "password changed");
    await h.drainQueue();

    h.setEmailFailure(
      new Error(`SMTP 451 rejected for user${user}@example.com token=abc123`),
    );
    await drainNotificationEmails(h.c);
    h.setEmailFailure(null);

    const [failed] = await deliveriesOf(user);
    expect(failed.status).toBe("pending");
    expect(failed.attempts).toBe(1);
    expect(failed.lastError).toBe(
      "SMTP 451 rejected for [email] token=[redacted]",
    );
    expect(failed.availableAt.getTime()).toBeGreaterThan(Date.now());
    expect(sentTo(user)).toHaveLength(0);

    await drainNotificationEmails(h.c);
    expect(sentTo(user)).toHaveLength(0);

    const later = new Date(Date.now() + 60 * 60 * 1000);
    await drainNotificationEmails(h.c, { now: later });
    await drainNotificationEmails(h.c, { now: later });

    expect(sentTo(user)).toHaveLength(1);
    const [sent] = await deliveriesOf(user);
    expect(sent).toMatchObject({ attempts: 2, status: "sent" });
  });

  it("re-checks preferences and read state before a delayed send", async () => {
    const [optedOut, alreadyRead] = await h.createUsers(2);
    await publish(alertType, optedOut, "a");
    await publish(alertType, alreadyRead, "b");
    await h.drainQueue();

    await updateNotificationPreferences(h.c, optedOut, {
      types: { "test.alert": { email: "none" } },
    });
    const [item] = await h.c
      .get("db")
      .select()
      .from(core_notifications)
      .where(eq(core_notifications.userId, alreadyRead));
    await markNotificationRead(h.c, {
      notificationId: item.id,
      userId: alreadyRead,
    });

    await drainNotificationEmails(h.c);

    expect(sentTo(optedOut)).toHaveLength(0);
    expect(sentTo(alreadyRead)).toHaveLength(0);
    expect((await deliveriesOf(optedOut))[0]?.status).toBe("skipped");
    expect((await deliveriesOf(alreadyRead))[0]?.status).toBe("skipped");
  });

  it("builds daily digests per local period across a DST change, once", async () => {
    const [user] = await h.createUsers(1);
    await h.c
      .get("db")
      .update(core_users)
      .set({ timeZone: "Europe/Warsaw" })
      .where(eq(core_users.id, user));

    const inside = await publish(newsType, user, "Saturday news");
    const after = await publish(newsType, user, "Sunday news");
    const readOne = await publish(newsType, user, "Already seen");
    await h.drainQueue();

    const setCreated = async (eventId: number, at: string) =>
      await h.c
        .get("db")
        .update(core_notification_receipts)
        .set({ createdAt: new Date(at) })
        .where(
          and(
            eq(core_notification_receipts.eventId, eventId),
            eq(core_notification_receipts.userId, user),
          ),
        );
    await setCreated(inside, "2026-03-28T12:00:00Z");
    await setCreated(readOne, "2026-03-28T13:00:00Z");
    await setCreated(after, "2026-03-29T06:30:00Z");

    const [seen] = await h.c
      .get("db")
      .select({ notificationId: core_notification_receipts.notificationId })
      .from(core_notification_receipts)
      .where(eq(core_notification_receipts.eventId, readOne));
    await markNotificationRead(h.c, {
      notificationId: seen.notificationId ?? 0,
      userId: user,
    });

    const warsawEightAmBeforeDstChange = new Date("2026-03-28T07:00:00Z");
    const warsawEightAmAfterDstChange = new Date("2026-03-29T06:00:00Z");
    const firstRun = new Date("2026-03-29T10:00:00Z");
    await planNotificationDigests(h.c, { now: firstRun });
    await planNotificationDigests(h.c, { now: firstRun });
    await drainNotificationEmails(h.c, { now: firstRun });

    const digests = (await deliveriesOf(user)).filter(
      row => row.mode === "daily",
    );
    expect(digests).toHaveLength(1);
    expect(digests[0]).toMatchObject({
      idempotencyKey: `daily:${user}:2026-03-29`,
      itemCount: 1,
      periodEnd: warsawEightAmAfterDstChange,
      periodStart: warsawEightAmBeforeDstChange,
      status: "sent",
    });
    expect(
      sentTo(user)
        .at(-1)
        ?.entries.map(entry => entry.title),
    ).toEqual(["Saturday news"]);

    const secondRun = new Date("2026-03-30T07:00:00Z");
    await planNotificationDigests(h.c, { now: secondRun });
    await drainNotificationEmails(h.c, { now: secondRun });

    expect(
      sentTo(user)
        .at(-1)
        ?.entries.map(entry => entry.title),
    ).toEqual(["Sunday news"]);

    const sent = sentTo(user).length;
    await planNotificationDigests(h.c, {
      now: new Date("2026-03-31T07:00:00Z"),
    });
    await drainNotificationEmails(h.c, {
      now: new Date("2026-03-31T07:00:00Z"),
    });
    expect(sentTo(user)).toHaveLength(sent);

    const pending = await h.c
      .get("db")
      .select()
      .from(core_notification_receipts)
      .where(
        and(
          eq(core_notification_receipts.userId, user),
          eq(core_notification_receipts.emailPending, true),
        ),
      );
    expect(pending).toHaveLength(0);
  });

  it("re-renders the same digest when its send is retried", async () => {
    const [user] = await h.createUsers(1);
    await publish(newsType, user, "One");
    await publish(newsType, user, "Two");
    await h.drainQueue();
    const now = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    await planNotificationDigests(h.c, { now });
    h.setEmailFailure(new Error("provider down"));
    await drainNotificationEmails(h.c, { now });
    h.setEmailFailure(null);

    await publish(newsType, user, "Three");
    await h.drainQueue();
    await drainNotificationEmails(h.c, {
      now: new Date(now.getTime() + 60 * 60 * 1000),
    });

    const titles = sentTo(user).flatMap(email =>
      email.entries.map(entry => entry.title),
    );
    expect(titles.sort()).toEqual(["One", "Two"]);

    const daily = (await deliveriesOf(user)).filter(
      row => row.mode === "daily",
    );
    expect(daily.map(row => row.status)).toEqual(["sent"]);
    expect(
      await h.c
        .get("db")
        .select()
        .from(core_notification_receipts)
        .where(
          and(
            eq(core_notification_receipts.userId, user),
            inArray(core_notification_receipts.emailDeliveryId, [daily[0].id]),
          ),
        ),
    ).toHaveLength(2);
  });
});
