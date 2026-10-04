// @vitest-environment node
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { z } from "zod";

import {
  buildNotificationSubject,
  buildNotificationType,
} from "@/api/lib/notifications/registry";
import {
  core_notification_deliveries,
  core_notification_events,
  core_notification_receipts,
  core_notification_subscriptions,
  core_notification_user_state,
  core_notifications,
} from "@/database/notifications";
import {
  createNotificationsHarness,
  type NotificationsHarness,
} from "@/tests/notifications";
import { describePostgres } from "@/tests/postgres";

import { processNotificationEvent } from "./fanout";

const RECIPIENTS = 1_000;
const BATCH = 200;

let accessCalls = 0;
const announcementType = buildNotificationType({
  id: "test.announcement",
  version: 1,
  schema: z.object({ title: z.string() }),
  category: "content",
  label: "test.announcement.label",
  subjectType: "test.topic",
  defaults: { email: "immediate", inApp: true },
  email: true,
  access: ({ userIds }) => {
    accessCalls += 1;

    return userIds;
  },
  present: ({ data }) => ({ title: data.title }),
});

const topicSubject = buildNotificationSubject({ type: "test.topic" });

/**
 * The 1,000-recipient case: half the audience named by the plugin, the rest
 * streamed from followers of a subject, with overlap between the two. Timings
 * are printed for the record, never asserted - they depend on the machine.
 */
describePostgres("notification fan-out with 1,000 recipients", () => {
  let h: NotificationsHarness;
  let users: number[] = [];

  beforeAll(async () => {
    h = await createNotificationsHarness({
      subjects: [topicSubject],
      types: [announcementType],
      workers: { fanoutBatchSize: BATCH },
    });
    users = await h.createUsers(RECIPIENTS + 1);

    // Users 1-600 follow the topic; 400-1000 are named explicitly (overlap 400-600).
    await h.c
      .get("db")
      .insert(core_notification_subscriptions)
      .values(
        users.slice(1, 601).map(userId => ({
          state: "following" as const,
          subjectId: "1",
          subjectType: "test.topic",
          userId,
        })),
      );
    // One follower muted the topic: they must get nothing.
    await h.c
      .get("db")
      .insert(core_notification_subscriptions)
      .values({
        state: "muted",
        subjectId: "1",
        subjectType: "test.topic",
        userId: users[700],
      })
      .onConflictDoNothing();
  }, 60_000);

  afterAll(async () => {
    await h?.database.drop();
  });

  it("delivers once per recipient in bounded batches, and survives repeated processing", async () => {
    const actor = users[0];
    const started = performance.now();
    const queriesBefore = h.queryCount();

    const { eventId } = await h.c.get("notifications").publish({
      actorId: actor,
      data: { title: "Big news" },
      followersOf: [{ id: 1, type: "test.topic" }],
      idempotencyKey: "announcement-1",
      recipients: [actor, ...users.slice(400)],
      subject: { id: 1, type: "test.topic" },
      type: announcementType,
    });
    const publishMs = performance.now() - started;

    // Two workers race on the same event; the event row lock serializes them.
    const fork = h.forkContext();
    const fanoutStarted = performance.now();
    await Promise.all([
      processNotificationEvent(h.c, eventId),
      processNotificationEvent(fork, eventId),
    ]);
    const fanoutMs = performance.now() - fanoutStarted;
    const fanoutQueries = h.queryCount() - queriesBefore;

    const expected = RECIPIENTS - 1; // everyone but the muted follower; the actor is skipped
    const countRows = async (
      table: typeof core_notification_receipts | typeof core_notifications,
    ) =>
      (
        await h.c
          .get("db")
          .select({ count: sql<number>`count(*)::integer` })
          .from(table)
      )[0]?.count;

    expect(await countRows(core_notifications)).toBe(expected);
    expect(await countRows(core_notification_receipts)).toBe(expected);

    const [event] = await h.c
      .get("db")
      .select()
      .from(core_notification_events)
      .where(eq(core_notification_events.id, eventId));
    expect(event).toMatchObject({
      deliveredCount: expected,
      status: "completed",
    });

    // Repeated processing: rewind the cursors as a crashed worker would leave
    // them, run it again twice, and nothing may change.
    await h.c
      .get("db")
      .update(core_notification_events)
      .set({
        followerSubjectCursor: 0,
        followerUserCursor: 0,
        recipientCursor: 0,
        status: "processing",
      })
      .where(eq(core_notification_events.id, eventId));
    await processNotificationEvent(h.c, eventId);
    await processNotificationEvent(h.c, eventId);

    expect(await countRows(core_notifications)).toBe(expected);
    const [{ total, wrong }] = await h.c
      .get("db")
      .select({
        total: sql<number>`sum(${core_notification_user_state.unreadCount})::integer`,
        wrong: sql<number>`count(*) filter (where ${core_notification_user_state.unreadCount} <> 1)::integer`,
      })
      .from(core_notification_user_state);
    expect(total).toBe(expected);
    expect(wrong).toBe(1); // the muted follower holds a 0

    const deliveries = await h.c
      .get("db")
      .select({ count: sql<number>`count(*)::integer` })
      .from(core_notification_deliveries);
    expect(deliveries[0]?.count).toBe(expected);

    // Bounded work: the access check ran once per batch, not per recipient,
    // and the whole fan-out took a fixed number of queries per batch.
    const batches = Math.ceil(600 / BATCH) + Math.ceil(601 / BATCH);
    expect(accessCalls).toBeLessThanOrEqual(batches * 2 + 4);
    expect(fanoutQueries).toBeLessThan(RECIPIENTS);

    // eslint-disable-next-line no-console
    console.info(
      `[1,000 recipients] publish ${publishMs.toFixed(0)} ms, fan-out ${fanoutMs.toFixed(0)} ms, ${fanoutQueries} queries for ${expected} recipients, ${accessCalls} access checks`,
    );
  }, 120_000);
});
