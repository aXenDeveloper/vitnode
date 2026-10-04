// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { z } from "zod";

import { buildNotificationType } from "@/api/lib/notifications/registry";
import {
  core_notification_deliveries,
  core_notification_events,
  core_notification_receipts,
  core_notification_user_state,
  core_notifications,
} from "@/database/notifications";
import {
  createNotificationsHarness,
  type NotificationsHarness,
} from "@/tests/notifications";
import { describePostgres } from "@/tests/postgres";

import { updateNotificationTypePolicy } from "./admin";
import {
  cancelQueuedNotificationEmails,
  deleteAllNotifications,
  markEverythingRead,
  pauseNotifications,
  resetMemberNotificationPreferences,
  resumeNotifications,
} from "./danger";
import { processNotificationEvent } from "./fanout";
import { getNotificationState } from "./inbox";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "./preferences";
import { loadNotificationSettings } from "./shared";
import { getNotificationStats } from "./stats";

const alertType = buildNotificationType({
  id: "test.alert",
  version: 1,
  schema: z.object({ text: z.string() }),
  category: "account",
  label: "test.alert.label",
  defaults: { email: "immediate", inApp: true },
  email: true,
  present: ({ data }) => ({ title: data.text, target: "/alerts" }),
});

const newsType = buildNotificationType({
  id: "test.news",
  version: 1,
  schema: z.object({ text: z.string() }),
  category: "content",
  label: "test.news.label",
  defaults: { email: "daily", inApp: true },
  email: true,
  present: ({ data }) => ({ title: data.text, target: "/news" }),
});

describePostgres("notification admin actions", () => {
  let h: NotificationsHarness;
  let seq = 0;

  beforeAll(async () => {
    h = await createNotificationsHarness({ types: [alertType, newsType] });
  });

  afterAll(async () => {
    await h?.database.drop();
  });

  const publish = async (type: typeof alertType, userId: number) => {
    seq += 1;
    await h.c.get("notifications").publish({
      actorId: null,
      data: { text: `n${seq}` },
      idempotencyKey: `admin-${seq}`,
      recipients: [userId],
      type,
    });
  };

  const itemsOf = async (userId: number) =>
    await h.c
      .get("db")
      .select()
      .from(core_notifications)
      .where(eq(core_notifications.userId, userId));

  const settle = async () => await h.drainQueue(new Date(Date.now() + 5000));

  const deliveriesOf = async (userId: number) =>
    await h.c
      .get("db")
      .select()
      .from(core_notification_deliveries)
      .where(eq(core_notification_deliveries.userId, userId));

  it("merges type policy changes instead of replacing the stored policy", async () => {
    await updateNotificationTypePolicy(h.c, "test.news", { inApp: false });
    await updateNotificationTypePolicy(h.c, "test.news", { allowPush: false });

    const { policies } = await loadNotificationSettings(h.c.get("db"));
    expect(policies.get("test.news")).toEqual({
      allowPush: false,
      inApp: false,
    });

    await updateNotificationTypePolicy(h.c, "test.news", {
      allowPush: true,
      inApp: true,
    });
  });

  it("refuses member changes to a type locked by the installation", async () => {
    const [user] = await h.createUsers(1);
    await updateNotificationTypePolicy(h.c, "test.news", {
      memberCanEdit: false,
    });

    await expect(
      updateNotificationPreferences(h.c, user, {
        types: { "test.news": { inApp: false } },
      }),
    ).rejects.toMatchObject({ status: 400 });

    const view = await getNotificationPreferences(h.c, { userId: user });
    expect(view.types.find(type => type.id === "test.news")?.locked).toBe(true);

    await updateNotificationTypePolicy(h.c, "test.news", {
      memberCanEdit: true,
    });
  });

  it("saves a member's push choice and refuses push the installation turned off", async () => {
    const [user] = await h.createUsers(1);
    await updateNotificationPreferences(h.c, user, {
      types: { "test.news": { push: false } },
    });

    const view = await getNotificationPreferences(h.c, { userId: user });
    expect(view.types.find(type => type.id === "test.news")).toMatchObject({
      pushAvailable: true,
      value: { push: false },
    });

    await updateNotificationTypePolicy(h.c, "test.news", { allowPush: false });
    await expect(
      updateNotificationPreferences(h.c, user, {
        types: { "test.news": { push: true } },
      }),
    ).rejects.toMatchObject({ status: 400 });
    await updateNotificationTypePolicy(h.c, "test.news", { allowPush: true });
  });

  it("shows a member the installation's email default next to their own choice", async () => {
    const [user] = await h.createUsers(1);
    await updateNotificationPreferences(h.c, user, {
      types: { "test.news": { email: "none" } },
    });
    await updateNotificationTypePolicy(h.c, "test.news", { email: "weekly" });

    const view = await getNotificationPreferences(h.c, { userId: user });
    expect(view.types.find(type => type.id === "test.news")).toMatchObject({
      defaultEmail: "weekly",
      value: { email: "none" },
    });

    await updateNotificationTypePolicy(h.c, "test.news", { email: "daily" });
  });

  it("holds every event while paused and delivers them on resume", async () => {
    const [user] = await h.createUsers(1);
    await pauseNotifications(h.c);
    await publish(alertType, user);
    await settle();

    expect(await itemsOf(user)).toHaveLength(0);
    expect(await deliveriesOf(user)).toHaveLength(0);

    const { requeuedEvents } = await resumeNotifications(h.c);
    await settle();

    expect(requeuedEvents).toBeGreaterThanOrEqual(1);
    expect(await itemsOf(user)).toHaveLength(1);
    expect((await deliveriesOf(user)).map(row => row.status)).toEqual(["sent"]);
    expect(h.emitted.map(event => event.name)).toEqual(
      expect.arrayContaining(["notifications.paused", "notifications.resumed"]),
    );
  });

  it("cancels every queued email and pending digest, and keeps the inbox", async () => {
    const [user] = await h.createUsers(1);
    seq += 1;
    const immediate = await h.c.get("notifications").publish({
      actorId: null,
      data: { text: `n${seq}` },
      idempotencyKey: `admin-${seq}`,
      recipients: [user],
      type: alertType,
    });
    seq += 1;
    const digest = await h.c.get("notifications").publish({
      actorId: null,
      data: { text: `n${seq}` },
      idempotencyKey: `admin-${seq}`,
      recipients: [user],
      type: newsType,
    });
    await processNotificationEvent(h.c, immediate.eventId);
    await processNotificationEvent(h.c, digest.eventId);

    const [queued] = await deliveriesOf(user);
    expect(queued?.status).toBe("pending");

    const { cancelled } = await cancelQueuedNotificationEmails(h.c);
    expect(cancelled).toBeGreaterThanOrEqual(1);

    expect((await deliveriesOf(user))[0]).toMatchObject({
      skipReason: "cancelled",
      status: "skipped",
    });
    const receipts = await h.c
      .get("db")
      .select()
      .from(core_notification_receipts)
      .where(eq(core_notification_receipts.userId, user));
    expect(receipts.every(row => !row.emailPending)).toBe(true);
    expect(await itemsOf(user)).toHaveLength(2);
  });

  it("marks everything read for everyone and zeroes every badge", async () => {
    const [first, second] = await h.createUsers(2);
    await publish(newsType, first);
    await publish(newsType, second);
    await publish(newsType, second);
    await settle();

    const result = await markEverythingRead(h.c);

    expect(result.items).toBeGreaterThanOrEqual(3);
    expect((await getNotificationState(h.c.get("db"), first)).unread).toBe(0);
    expect((await getNotificationState(h.c.get("db"), second)).unread).toBe(0);
    expect(
      h.realtime.filter(record => record.userId === second).at(-1)?.data,
    ).toMatchObject({ reason: "read_all", unread: 0 });
  });

  it("reports activity per bucket in the viewer's time zone", async () => {
    const [first, second] = await h.createUsers(2);
    const before = await getNotificationStats(h.c, {
      range: "24h",
      timeZone: "Europe/Warsaw",
    });
    await publish(alertType, first);
    await publish(alertType, second);
    await settle();

    const stats = await getNotificationStats(h.c, {
      range: "24h",
      timeZone: "Europe/Warsaw",
    });

    expect(stats.points).toHaveLength(24);
    expect(stats.totals.events).toBe(before.totals.events + 2);
    expect(stats.totals.sent).toBe(before.totals.sent + 2);
  });

  it("resets every member's own choices to the installation defaults", async () => {
    const [user] = await h.createUsers(1);
    await updateNotificationPreferences(h.c, user, {
      types: { "test.news": { inApp: false } },
    });

    const { members } = await resetMemberNotificationPreferences(h.c);

    const [state] = await h.c
      .get("db")
      .select()
      .from(core_notification_user_state)
      .where(eq(core_notification_user_state.userId, user));
    expect(members).toBeGreaterThanOrEqual(1);
    expect(state).toMatchObject({
      preferences: {},
    });
  });

  it("deletes every notification and the events nothing points at any more", async () => {
    const [user] = await h.createUsers(1);
    await publish(newsType, user);
    await settle();

    const result = await deleteAllNotifications(h.c);

    expect(result.items).toBeGreaterThanOrEqual(1);
    expect(await h.c.get("db").select().from(core_notifications)).toHaveLength(
      0,
    );
    expect(
      (await h.c.get("db").select().from(core_notification_events)).every(
        event => event.status === "pending" || event.status === "processing",
      ),
    ).toBe(true);
    expect((await getNotificationState(h.c.get("db"), user)).unread).toBe(0);
  });
});
