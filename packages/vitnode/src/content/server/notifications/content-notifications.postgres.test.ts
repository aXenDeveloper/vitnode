import type { Context } from "hono";

import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";
import type { PostgresTestSchema } from "@/tests/postgres";

import { createNotificationRegistry } from "@/api/lib/notifications/registry";
import { buildApiPlugin } from "@/api/lib/plugin";
import { NotificationsModel } from "@/api/models/notifications";
import { listNotifications } from "@/api/models/notifications/inbox";
import { QueueModel } from "@/api/models/queue";
import { contentNotificationsQueueTask } from "@/api/modules/content/tasks/content-notifications.task";
import { notificationsFanoutTask } from "@/api/modules/notifications/tasks/notification-tasks";
import { processQueueTasks } from "@/api/modules/queue/helpers/process-queue-tasks";
import { decideContentSubmission } from "@/content/approvals/server/decide";
import { openContentSubmission } from "@/content/approvals/server/submissions";
import { CONTENT_QUEUE_TASK_NOTIFICATIONS } from "@/content/const";
import { CONTENT_SYSTEM_ACTOR } from "@/content/server/actor";
import { core_languages } from "@/database/languages";
import {
  core_notification_events,
  core_notification_user_state,
  core_notifications,
} from "@/database/notifications";
import { core_queue } from "@/database/queue";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import { createTestCache } from "@/tests/cache";
import {
  noticeComments,
  noticeQuiet,
  noticeTopics,
  testNoticeCommentContentType,
  testNoticeTopicContentType,
  testTopicPublishedNotification,
} from "@/tests/content-notification-fixtures";
import { testManifest } from "@/tests/manifest";
import { createPostgresTestSchema, POSTGRES_TEST_URL } from "@/tests/postgres";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import type { ContentNotificationIntent } from "./intents";

import { contentNotificationRefs } from "./access";
import { buildContentNotifications } from "./define";
import { processContentNotificationIntent } from "./process";
import { createContentNotificationRegistry } from "./registry";

const PLUGIN_ID = "@vitnode/ntest";

const TOPIC_AUTHOR = 1;
const COMMENTER = 2;
const REPLIER = 3;
const MODERATOR = 4;
const WATCHER = 5;
const USERS = [TOPIC_AUTHOR, COMMENTER, REPLIER, MODERATOR, WATCHER];

const REPLY_TYPE = "ntest.comment_reply";
const DECISION_TYPE = "ntest.comment_decision";
const TOPIC_TYPE = testTopicPublishedNotification.id;

/** Without `rootAuthorField` the rule covers replies only, as on Blog. */
const commentNotifications = (rootAuthorField?: "author") =>
  buildContentNotifications({
    content: testNoticeCommentContentType,
    root: testNoticeTopicContentType,
    rules: {
      replies: {
        id: REPLY_TYPE,
        preset: "threadReply",
        grouping: { windowMinutes: 60 },
        recipients: { authorField: "author", rootAuthorField },
        messages: {
          label: "ntest.reply.label",
          comment: "ntest.reply.comment",
          reply: "ntest.reply.reply",
        },
        target: ({ content, root }) =>
          `/topics/${root.id}#comment-${content.id}`,
      },
      decisions: {
        id: DECISION_TYPE,
        preset: "moderationDecision",
        messages: {
          label: "ntest.decision.label",
          approved: "ntest.decision.approved",
          rejected: "ntest.decision.rejected",
        },
        target: ({ content, decision }) =>
          decision.status === "approved"
            ? `/comments/${content.id}`
            : "/pending",
      },
    },
  });

const topicNotifications = buildContentNotifications({
  content: testNoticeTopicContentType,
  rules: {
    published: {
      type: testTopicPublishedNotification,
      on: "firstPublication",
      recipients: () => [WATCHER],
      data: context => ({
        ...contentNotificationRefs(context),
        title: context.content.title,
      }),
    },
  },
});

const contentModels = [noticeTopics, noticeComments, noticeQuiet].map(
  model => ({ model, pluginId: PLUGIN_ID }),
);

const registriesOf = (comments: ReturnType<typeof commentNotifications>) => {
  const plugin = buildApiPlugin({
    manifest: testManifest(PLUGIN_ID),
    modules: [],
    contentNotifications: [comments, topicNotifications],
  });

  return {
    contentNotifications: createContentNotificationRegistry(
      (plugin.contentNotifications ?? []).map(config => ({
        config,
        pluginId: PLUGIN_ID,
      })),
      contentModels,
    ),
    notifications: createNotificationRegistry(
      (plugin.notificationTypes ?? []).map(definition => ({
        definition,
        pluginId: PLUGIN_ID,
      })),
    ),
  };
};

const threadRules = registriesOf(commentNotifications("author"));
const repliesOnlyRules = registriesOf(commentNotifications());

const core = {
  contentModels,
  ...threadRules,
  queue: [contentNotificationsQueueTask, notificationsFanoutTask].map(task => ({
    ...task,
    module: "test",
    pluginId: "@vitnode/core",
  })),
};

const log = {
  debug: async () => {},
  error: async () => {},
  warn: async () => {},
};

const i18n = {
  getTranslator: async () => await Promise.resolve((key: string) => key),
  resolveLocale: () => "en",
  resolveSupportedLocale: () => "en",
};

type TestContext = Context<EnvVitNode>;

describe.skipIf(!POSTGRES_TEST_URL)(
  "content notifications on PostgreSQL",
  () => {
    let schema: PostgresTestSchema;
    const cache = createTestCache();

    /** A real Hono context carrying what the services and the worker read. */
    const contextAs = async (userId: null | number): Promise<TestContext> => {
      let captured: TestContext | undefined;
      const app = new Hono<EnvVitNode>();
      app.get("/", c => {
        c.set("db", schema.db as never);
        c.set("core", core as never);
        c.set("cache", cache);
        c.set("log", log);
        c.set("realtime", { sendToUsers: () => undefined } as never);
        c.set("events", { emit: async () => {} } as never);
        c.set("i18n", i18n as never);
        c.set("admin", null);
        c.set("plugin", { id: PLUGIN_ID });
        c.set(
          "user",
          userId === null
            ? null
            : ({ id: userId, language: "en", name: `user${userId}` } as never),
        );
        c.set("queue", new QueueModel(c));
        const notifications = new NotificationsModel(c);
        // Queued work runs through `drain()`, never in the background.
        vi.spyOn(notifications, "flushAfterResponse").mockImplementation(
          () => undefined,
        );
        c.set("notifications", notifications);
        captured = c;

        return c.body(null, 204);
      });
      await app.request("/");
      if (!captured) throw new Error("no context");

      return captured;
    };

    /** Runs every due queue task - intents, then their fan-out - to the end. */
    const drain = async () => {
      await processQueueTasks(await contextAs(null), {
        lockKey: `test-queue:${Math.random()}`,
      });
    };

    const intents = async (contentTypeId?: string) =>
      (
        await schema.db
          .select({ payload: core_queue.payload })
          .from(core_queue)
          .where(eq(core_queue.name, CONTENT_QUEUE_TASK_NOTIFICATIONS))
          .orderBy(asc(core_queue.id))
      )
        .map(row => row.payload as ContentNotificationIntent)
        .filter(
          intent =>
            contentTypeId === undefined ||
            intent.contentTypeId === contentTypeId,
        );

    const events = async (type?: string) =>
      await schema.db
        .select({
          actorId: core_notification_events.actorId,
          data: core_notification_events.data,
          id: core_notification_events.id,
          idempotencyKey: core_notification_events.idempotencyKey,
          recipientIds: core_notification_events.recipientIds,
          type: core_notification_events.type,
        })
        .from(core_notification_events)
        .where(type ? eq(core_notification_events.type, type) : undefined)
        .orderBy(asc(core_notification_events.id));

    const eventsAbout = async (commentId: number) =>
      (await events(REPLY_TYPE)).filter(
        event =>
          (event.data as { contentId: string }).contentId === String(commentId),
      );

    const items = async (userId: number, type = REPLY_TYPE) =>
      await schema.db
        .select()
        .from(core_notifications)
        .where(
          and(
            eq(core_notifications.userId, userId),
            eq(core_notifications.type, type),
          ),
        );

    /** The inbox as the member sees it, read with a fresh context each time. */
    const inbox = async (userId: number) =>
      (await listNotifications(await contextAs(userId), { limit: 50, userId }))
        .items;

    const topicService = (c: TestContext) => {
      const build = noticeTopics.editorialService;
      if (!build) throw new Error("topics are editorial");

      return build(c, { pluginId: PLUGIN_ID });
    };

    const createTopic = async ({
      author = TOPIC_AUTHOR,
      publish = true,
    }: { author?: null | number; publish?: boolean } = {}): Promise<number> => {
      const c = await contextAs(author);
      const actor = { type: "api", userId: author } as const;

      return await schema.db.transaction(async tx => {
        const { row } = await topicService(c).create(
          { author, title: "A topic" },
          { actor, tx },
        );
        if (publish) await topicService(c).publish(row.id, { actor, tx });

        return row.id;
      });
    };

    const createComment = async ({
      actor,
      author,
      parent = null,
      publish = true,
      topic,
    }: {
      actor?: null | number;
      author: null | number;
      parent?: null | number;
      publish?: boolean;
      topic: number;
    }): Promise<number> => {
      const c = await contextAs(actor === undefined ? author : actor);
      const service = noticeComments.service(c);

      return await schema.db.transaction(async tx => {
        const row = await service.create(
          { author, body: "Hello", parent, topic },
          { tx },
        );
        if (publish) await service.publish(row.id, { tx });

        return row.id;
      });
    };

    const comments = async (userId: null | number = COMMENTER) =>
      noticeComments.service(await contextAs(userId));

    const submit = async (
      itemId: number,
      kind: "create" | "edit",
      values: Record<string, unknown> = {},
      baseUpdatedAt?: Date,
    ) => {
      const c = await contextAs(COMMENTER);

      return (
        await schema.db.transaction(
          async tx =>
            await openContentSubmission(c, tx, {
              authorId: COMMENTER,
              baseUpdatedAt,
              container: null,
              definition: testNoticeCommentContentType,
              itemId,
              kind,
              pluginId: PLUGIN_ID,
              values,
            }),
        )
      ).row.id;
    };

    const decide = async (id: number, decision: "approve" | "reject") =>
      await decideContentSubmission(await contextAs(MODERATOR), {
        decision,
        id,
        reason: decision === "reject" ? "Off topic" : null,
        reviewerId: MODERATOR,
      });

    beforeAll(async () => {
      schema = await createPostgresTestSchema({
        prefix: "vitnode_content_notifications",
        tables: {
          ntest_comments: noticeComments.table,
          ntest_quiet: noticeQuiet.table,
          ntest_topics: noticeTopics.table,
        },
      });
      await schema.db
        .insert(core_languages)
        .values({ code: "en", name: "English" });
      const [role] = await schema.db
        .insert(core_roles)
        .values({ updatedAt: new Date() })
        .returning({ id: core_roles.id });
      await schema.db.insert(core_users).values(
        USERS.map(id => ({
          avatarColor: "000000",
          email: `user${id}@example.com`,
          id,
          ipAddress: "127.0.0.1",
          name: `user${id}`,
          nameCode: `user${id}`,
          roleId: role.id,
        })),
      );
      await grantStaffPermissions(cache, {
        permissions: { permissions: [], root: true },
        type: "moderator",
        userId: MODERATOR,
      });
    }, 120_000);

    afterAll(async () => {
      await schema?.drop();
    });

    beforeEach(async () => {
      vi.restoreAllMocks();
      Object.assign(core, threadRules);
      await schema.client.unsafe(
        `truncate ntest_comments, ntest_topics, ntest_quiet, core_queue,
          core_notification_events, core_notifications, core_notification_receipts,
          core_notification_deliveries, core_notification_user_state,
          core_content_submissions, core_content_revisions restart identity cascade`,
      );
    });

    describe("intents", () => {
      it("stores exactly one intent for a record created and published in one transaction", async () => {
        const topic = await createTopic();
        const comment = await createComment({ author: COMMENTER, topic });

        await expect(intents(testNoticeCommentContentType.id)).resolves.toEqual(
          [
            {
              actorId: COMMENTER,
              contentTypeId: "ntest.comment",
              itemId: String(comment),
              ruleIds: [REPLY_TYPE],
              trigger: "firstPublication",
              v: 1,
            },
          ],
        );
      });

      it("stores one intent with no actor for a scheduled publish", async () => {
        const topic = await createTopic({ publish: false });
        const c = await contextAs(null);

        await schema.db.transaction(async tx => {
          await topicService(c).publish(topic, {
            actor: CONTENT_SYSTEM_ACTOR,
            tx,
          });
        });

        await expect(intents(testNoticeTopicContentType.id)).resolves.toEqual([
          expect.objectContaining({
            actorId: null,
            itemId: String(topic),
            ruleIds: [TOPIC_TYPE],
          }),
        ]);
        await drain();
        await expect(events(TOPIC_TYPE)).resolves.toEqual([
          expect.objectContaining({ actorId: null, recipientIds: [WATCHER] }),
        ]);
        await expect(inbox(WATCHER)).resolves.toEqual([
          expect.objectContaining({ available: true, title: "A topic" }),
        ]);
      });

      it("stores nothing for a content type without rules", async () => {
        const service = noticeQuiet.service(await contextAs(COMMENTER));
        const row = await service.create({ author: COMMENTER, title: "Quiet" });

        await expect(service.publish(row.id)).resolves.toMatchObject({
          changed: true,
        });
        await expect(intents()).resolves.toEqual([]);
      });

      it.each<
        [string, (ids: { comment: number; topic: number }) => Promise<unknown>]
      >([
        [
          "a draft create",
          async ({ topic }) =>
            await createComment({ author: COMMENTER, publish: false, topic }),
        ],
        [
          "an update",
          async ({ comment }) =>
            await (await comments()).update(comment, { body: "Edited" }),
        ],
        [
          "unpublishing and republishing",
          async ({ comment }) => {
            const service = await comments();
            await service.unpublish(comment);
            await service.publish(comment);
          },
        ],
        [
          "hiding and unhiding",
          async ({ comment }) => {
            const service = await comments(MODERATOR);
            await service.hide(comment, { actorUserId: MODERATOR });
            await service.unhide(comment, { actorUserId: MODERATOR });
          },
        ],
        [
          "an editorial update, unpublish and republish",
          async ({ topic }) => {
            const service = topicService(await contextAs(TOPIC_AUTHOR));
            const actor = { type: "api", userId: TOPIC_AUTHOR } as const;
            const updated = await service.update(
              topic,
              { title: "Renamed" },
              { actor, expectedVersion: 2 },
            );
            expect(updated?.changed).toBe(true);
            await service.unpublish(topic, { actor });
            await service.publish(topic, { actor });
          },
        ],
      ])("stores nothing for %s", async (_, operation) => {
        const topic = await createTopic();
        const comment = await createComment({ author: COMMENTER, topic });
        await schema.db.delete(core_queue);

        await operation({ comment, topic });

        await expect(intents()).resolves.toEqual([]);
      });

      it("drops the intent with the transaction that rolls back", async () => {
        const topic = await createTopic();
        await schema.db.delete(core_queue);
        const service = await comments();

        await expect(
          schema.db.transaction(async tx => {
            const row = await service.create(
              { author: COMMENTER, body: "Hello", parent: null, topic },
              { tx },
            );
            await service.publish(row.id, { tx });
            throw new Error("rolled back");
          }),
        ).rejects.toThrow("rolled back");

        await expect(intents()).resolves.toEqual([]);
        await expect(
          schema.db.select().from(noticeComments.table),
        ).resolves.toEqual([]);
      });
    });

    describe("moderation", () => {
      it("stores the first publication once and the decision when a create is approved", async () => {
        const topic = await createTopic();
        const comment = await createComment({
          author: COMMENTER,
          publish: false,
          topic,
        });
        await schema.db.delete(core_queue);
        const submission = await submit(comment, "create");

        await decide(submission, "approve");

        await expect(intents(testNoticeCommentContentType.id)).resolves.toEqual(
          [
            expect.objectContaining({
              actorId: MODERATOR,
              itemId: String(comment),
              trigger: "firstPublication",
            }),
            expect.objectContaining({
              decision: "approved",
              submissionId: submission,
              trigger: "moderationDecision",
            }),
          ],
        );

        await drain();
        // The thread hears from the comment's author, not the moderator.
        await expect(events(REPLY_TYPE)).resolves.toEqual([
          expect.objectContaining({
            actorId: COMMENTER,
            data: expect.objectContaining({ relation: "comment" }),
            recipientIds: [TOPIC_AUTHOR],
          }),
        ]);
        await expect(events(DECISION_TYPE)).resolves.toEqual([
          expect.objectContaining({
            actorId: null,
            data: expect.objectContaining({
              decision: "approved",
              kind: "create",
            }),
            idempotencyKey: `decision:ntest.comment:${submission}`,
            recipientIds: [COMMENTER],
          }),
        ]);
      });

      it("stores only the decision when an edit is approved", async () => {
        const topic = await createTopic();
        const comment = await createComment({ author: COMMENTER, topic });
        const [row] = await schema.db
          .select({ updatedAt: noticeComments.table.updatedAt })
          .from(noticeComments.table);
        await schema.db.delete(core_queue);
        const submission = await submit(
          comment,
          "edit",
          { body: "Better" },
          row.updatedAt,
        );

        await decide(submission, "approve");

        await expect(intents()).resolves.toEqual([
          expect.objectContaining({
            decision: "approved",
            trigger: "moderationDecision",
          }),
        ]);
      });

      it("tells the submitter about each submission, and a rejection while the record is a draft", async () => {
        const topic = await createTopic();
        const comment = await createComment({
          author: COMMENTER,
          publish: false,
          topic,
        });

        await decide(await submit(comment, "create"), "reject");
        await drain();
        await expect(inbox(COMMENTER)).resolves.toEqual([
          expect.objectContaining({
            available: true,
            target: "/pending",
            title: "ntest.decision.rejected",
          }),
        ]);

        await decide(await submit(comment, "create"), "approve");
        await drain();

        await expect(events(DECISION_TYPE)).resolves.toHaveLength(2);
        await expect(inbox(COMMENTER)).resolves.toEqual([
          expect.objectContaining({
            available: true,
            title: "ntest.decision.approved",
          }),
          expect.objectContaining({
            available: true,
            title: "ntest.decision.rejected",
          }),
        ]);
      });

      it("lets only the submitter see a decision", async () => {
        const topic = await createTopic();
        const comment = await createComment({
          author: COMMENTER,
          publish: false,
          topic,
        });
        await decide(await submit(comment, "create"), "reject");
        await drain();
        const [event] = await events(DECISION_TYPE);
        const access = core.notifications.get(DECISION_TYPE)?.definition.access;

        await expect(
          access?.({
            c: await contextAs(null),
            data: event.data,
            subject: { id: String(comment), type: "ntest.comment" },
            userIds: [COMMENTER, TOPIC_AUTHOR, MODERATOR],
          }),
        ).resolves.toEqual([COMMENTER]);
      });
    });

    describe("recipients", () => {
      it.each<
        [
          string,
          {
            actor?: null | number;
            comment: null | number;
            parent?: null | number;
            topic: null | number;
          },
          { recipients: number[]; relation: "comment" | "reply" }[],
          rules?: typeof threadRules,
        ]
      >([
        [
          "the topic's author hears about a comment",
          { comment: COMMENTER, topic: TOPIC_AUTHOR },
          [{ recipients: [TOPIC_AUTHOR], relation: "comment" }],
        ],
        [
          "the parent's author hears about a reply, the topic's author about a comment",
          { comment: REPLIER, parent: COMMENTER, topic: TOPIC_AUTHOR },
          [
            { recipients: [COMMENTER], relation: "reply" },
            { recipients: [TOPIC_AUTHOR], relation: "comment" },
          ],
        ],
        [
          "a member who is both the parent's and the topic's author gets the reply only",
          { comment: REPLIER, parent: TOPIC_AUTHOR, topic: TOPIC_AUTHOR },
          [{ recipients: [TOPIC_AUTHOR], relation: "reply" }],
        ],
        [
          "the author never hears about their own reply",
          { comment: TOPIC_AUTHOR, parent: COMMENTER, topic: TOPIC_AUTHOR },
          [{ recipients: [COMMENTER], relation: "reply" }],
        ],
        [
          "whoever publishes it is left out too",
          {
            actor: TOPIC_AUTHOR,
            comment: REPLIER,
            parent: COMMENTER,
            topic: TOPIC_AUTHOR,
          },
          [{ recipients: [COMMENTER], relation: "reply" }],
        ],
        [
          "a topic and a parent without authors notify nobody",
          { comment: REPLIER, parent: null, topic: null },
          [],
        ],
        [
          "a comment without an author still reaches the topic's author",
          { actor: null, comment: null, topic: TOPIC_AUTHOR },
          [{ recipients: [TOPIC_AUTHOR], relation: "comment" }],
        ],
        [
          "without a root author field, a comment notifies nobody",
          { comment: COMMENTER, topic: TOPIC_AUTHOR },
          [],
          repliesOnlyRules,
        ],
        [
          "without a root author field, only the parent's author hears about a reply",
          { comment: REPLIER, parent: COMMENTER, topic: TOPIC_AUTHOR },
          [{ recipients: [COMMENTER], relation: "reply" }],
          repliesOnlyRules,
        ],
      ])("%s", async (_, authors, expected, rules = threadRules) => {
        Object.assign(core, rules);
        const topic = await createTopic({ author: authors.topic });
        const parent =
          authors.parent === undefined
            ? null
            : await createComment({ author: authors.parent, topic });
        await drain();

        const comment = await createComment({
          actor: authors.actor,
          author: authors.comment,
          parent,
          topic,
        });
        await drain();

        expect(
          (await eventsAbout(comment)).map(event => ({
            recipients: event.recipientIds,
            relation: (event.data as { relation: string }).relation,
          })),
        ).toEqual(expected);
      });

      it("words a merged notification as a reply in the inbox", async () => {
        const topic = await createTopic();
        const parent = await createComment({ author: TOPIC_AUTHOR, topic });
        await createComment({ author: REPLIER, parent, topic });
        await drain();

        await expect(inbox(TOPIC_AUTHOR)).resolves.toEqual([
          expect.objectContaining({
            available: true,
            target: expect.stringMatching(/#comment-\d+$/),
            title: "ntest.reply.reply",
          }),
        ]);
      });

      it("respects a member who turned the type off", async () => {
        await schema.db.insert(core_notification_user_state).values({
          preferences: { [REPLY_TYPE]: { email: "none", inApp: false } },
          userId: TOPIC_AUTHOR,
        });
        const topic = await createTopic();
        await createComment({ author: COMMENTER, topic });
        await drain();

        await expect(events(REPLY_TYPE)).resolves.toHaveLength(1);
        await expect(items(TOPIC_AUTHOR)).resolves.toEqual([]);
      });
    });

    describe("reliability", () => {
      const publishedComment = async () => {
        const topic = await createTopic();
        const parent = await createComment({ author: COMMENTER, topic });
        await drain();
        await schema.db.delete(core_queue);
        const comment = await createComment({ author: REPLIER, parent, topic });
        const [intent] = await intents(testNoticeCommentContentType.id);

        return { comment, intent };
      };

      it("publishes once however often the intent is processed", async () => {
        const { comment, intent } = await publishedComment();

        await expect(
          processContentNotificationIntent(await contextAs(null), intent),
        ).resolves.toEqual({ published: 2, status: "processed" });
        // As if the worker died after publishing: the queue runs it again.
        await processContentNotificationIntent(await contextAs(null), intent);
        await drain();
        await processContentNotificationIntent(await contextAs(null), intent);
        await drain();

        await expect(eventsAbout(comment)).resolves.toHaveLength(2);
        await expect(items(COMMENTER)).resolves.toMatchObject([
          { eventCount: 1 },
        ]);
        // The topic author's item already holds the parent comment.
        await expect(items(TOPIC_AUTHOR)).resolves.toMatchObject([
          { eventCount: 2 },
        ]);
      });

      it("stays idempotent when two workers process it at once", async () => {
        const { comment, intent } = await publishedComment();
        const [first, second] = await Promise.all([
          contextAs(null),
          contextAs(null),
        ]);

        await expect(
          Promise.all([
            processContentNotificationIntent(first, intent),
            processContentNotificationIntent(second, intent),
          ]),
        ).resolves.toEqual([
          { published: 2, status: "processed" },
          { published: 2, status: "processed" },
        ]);
        await expect(eventsAbout(comment)).resolves.toHaveLength(2);
      });

      it("leaves no partial events when publishing fails, and a retry succeeds", async () => {
        const { comment, intent } = await publishedComment();
        const c = await contextAs(null);
        const notifications = c.get("notifications");
        const publish = notifications.publish.bind(notifications);
        let calls = 0;
        vi.spyOn(notifications, "publish").mockImplementation(async args => {
          calls += 1;
          if (calls === 2) throw new Error("database hiccup");

          return await publish(args);
        });

        await expect(
          processContentNotificationIntent(c, intent),
        ).rejects.toThrow("database hiccup");
        await expect(eventsAbout(comment)).resolves.toEqual([]);
        await expect(
          schema.db
            .select()
            .from(core_queue)
            .where(eq(core_queue.name, "notifications-fanout")),
        ).resolves.toEqual([]);

        vi.restoreAllMocks();
        await expect(
          processContentNotificationIntent(await contextAs(null), intent),
        ).resolves.toEqual({ published: 2, status: "processed" });
        await drain();
        await expect(eventsAbout(comment)).resolves.toHaveLength(2);
        await expect(items(COMMENTER)).resolves.toMatchObject([
          { eventCount: 1 },
        ]);
        await expect(items(TOPIC_AUTHOR)).resolves.toMatchObject([
          { eventCount: 2 },
        ]);
      });

      it.each([
        [
          "hidden",
          async (id: number) =>
            await (
              await comments(MODERATOR)
            ).hide(id, { actorUserId: MODERATOR }),
        ],
        [
          "unpublished",
          async (id: number) => await (await comments()).unpublish(id),
        ],
        ["deleted", async (id: number) => await (await comments()).delete(id)],
      ])(
        "announces nothing about a record %s before it was processed",
        async (_, change) => {
          const topic = await createTopic();
          await drain();
          await createComment({ author: COMMENTER, topic });
          const [intent] = await intents(testNoticeCommentContentType.id);
          const [{ id }] = await schema.db
            .select({ id: noticeComments.table.id })
            .from(noticeComments.table);

          await change(id);

          await expect(
            processContentNotificationIntent(await contextAs(null), intent),
          ).resolves.toMatchObject({ status: "skipped" });
          await expect(events(REPLY_TYPE)).resolves.toEqual([]);
        },
      );
    });

    describe("access and clean-up", () => {
      const notifiedComment = async () => {
        const topic = await createTopic();
        const comment = await createComment({ author: COMMENTER, topic });
        await drain();

        return { comment, topic };
      };

      it.each<
        [
          string,
          (ids: { comment: number; topic: number }) => Promise<void>,
          (ids: { comment: number; topic: number }) => Promise<void>,
        ]
      >([
        [
          "the comment is hidden",
          async ({ comment }) => {
            await (
              await comments(MODERATOR)
            ).hide(comment, { actorUserId: MODERATOR });
          },
          async ({ comment }) => {
            await (
              await comments(MODERATOR)
            ).unhide(comment, { actorUserId: MODERATOR });
          },
        ],
        [
          "the comment is unpublished",
          async ({ comment }) => {
            await (await comments()).unpublish(comment);
          },
          async ({ comment }) => {
            await (await comments()).publish(comment);
          },
        ],
        [
          "the topic is hidden",
          async ({ topic }) => {
            await topicService(await contextAs(MODERATOR)).hide(topic, {
              actor: { type: "api", userId: MODERATOR },
            });
          },
          async ({ topic }) => {
            await topicService(await contextAs(MODERATOR)).unhide(topic, {
              actor: { type: "api", userId: MODERATOR },
            });
          },
        ],
      ])(
        "shows a placeholder while %s, and the notification again once restored",
        async (_, hide, restore) => {
          const ids = await notifiedComment();
          await expect(inbox(TOPIC_AUTHOR)).resolves.toMatchObject([
            { available: true, title: "ntest.reply.comment" },
          ]);

          await hide(ids);
          await expect(inbox(TOPIC_AUTHOR)).resolves.toMatchObject([
            {
              available: false,
              target: null,
              title: "core.notifications.unavailable",
            },
          ]);

          await restore(ids);
          await expect(inbox(TOPIC_AUTHOR)).resolves.toMatchObject([
            { available: true, title: "ntest.reply.comment" },
          ]);
        },
      );

      it("removes the inbox item of a deleted comment", async () => {
        const { comment } = await notifiedComment();
        await expect(
          (await contextAs(TOPIC_AUTHOR))
            .get("notifications")
            .state(TOPIC_AUTHOR),
        ).resolves.toMatchObject({ unread: 1 });

        await (await comments()).delete(comment);
        await drain();

        await expect(items(TOPIC_AUTHOR)).resolves.toEqual([]);
        await expect(
          (await contextAs(TOPIC_AUTHOR))
            .get("notifications")
            .state(TOPIC_AUTHOR),
        ).resolves.toMatchObject({ unread: 0 });
      });

      it("keeps a grouped item's other comments when one is deleted", async () => {
        const { comment, topic } = await notifiedComment();
        const other = await createComment({ author: REPLIER, topic });
        await drain();
        await expect(items(TOPIC_AUTHOR)).resolves.toMatchObject([
          { eventCount: 2 },
        ]);
        const [, otherEvent] = await events(REPLY_TYPE);

        await (await comments()).delete(comment);
        await drain();

        await expect(items(TOPIC_AUTHOR)).resolves.toMatchObject([
          {
            eventCount: 1,
            latestEventId: otherEvent.id,
            subjectId: String(other),
          },
        ]);
      });

      it("removes the items of every comment that went with a deleted topic", async () => {
        const { comment, topic } = await notifiedComment();
        await createComment({ author: REPLIER, parent: comment, topic });
        await drain();
        await expect(items(COMMENTER)).resolves.toHaveLength(1);
        await expect(items(WATCHER, TOPIC_TYPE)).resolves.toHaveLength(1);
        const [row] = await schema.db
          .select({ version: noticeTopics.table.version })
          .from(noticeTopics.table);

        await topicService(await contextAs(TOPIC_AUTHOR)).delete(topic, {
          actor: { type: "api", userId: TOPIC_AUTHOR },
          expectedVersion: row.version,
        });
        await drain();

        await expect(
          schema.db.select().from(noticeComments.table),
        ).resolves.toEqual([]);
        await expect(
          schema.db
            .select({ id: core_notifications.id })
            .from(core_notifications),
        ).resolves.toEqual([]);
      });
    });
  },
);
