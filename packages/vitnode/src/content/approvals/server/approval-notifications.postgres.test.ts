import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { and, asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";
import type { EnvVitNode } from "@/api/middlewares/global.middleware";
import type { ContentNotificationIntent } from "@/content/server/notifications/intents";
import type { ContentDatabase } from "@/content/server/service";
import type { PostgresTestSchema } from "@/tests/postgres";

import { resolveStaffPermissions } from "@/api/lib/check-staff-permission";
import { createNotificationRegistry } from "@/api/lib/notifications/registry";
import { buildApiPlugin } from "@/api/lib/plugin";
import { NotificationsModel } from "@/api/models/notifications";
import { listNotifications } from "@/api/models/notifications/inbox";
import { QueueModel } from "@/api/models/queue";
import { contentNotificationsQueueTask } from "@/api/modules/content/tasks/content-notifications.task";
import { moderationModule } from "@/api/modules/moderation/moderation.module";
import { notificationsFanoutTask } from "@/api/modules/notifications/tasks/notification-tasks";
import { processQueueTasks } from "@/api/modules/queue/helpers/process-queue-tasks";
import {
  CONTENT_PERMISSIONS,
  CONTENT_QUEUE_TASK_NOTIFICATIONS,
} from "@/content/const";
import { resolveContentRowContainer } from "@/content/containers/server/policy";
import { buildContentNotifications } from "@/content/server/notifications/define";
import { processContentNotificationIntent } from "@/content/server/notifications/process";
import { createContentNotificationRegistry } from "@/content/server/notifications/registry";
import { core_content_containers } from "@/database/content-containers";
import { core_content_submissions } from "@/database/content-submissions";
import { core_languages } from "@/database/languages";
import { core_moderators_permissions } from "@/database/moderators";
import {
  core_notification_events,
  core_notification_receipts,
  core_notifications,
} from "@/database/notifications";
import { core_queue } from "@/database/queue";
import { core_roles } from "@/database/roles";
import { core_users, core_users_secondary_roles } from "@/database/users";
import { resolvePersonalInformationFields } from "@/lib/user-personal-information";
import { createTestCache } from "@/tests/cache";
import {
  testPolicyBoardContainers,
  testPolicyReplyContentType,
  testPolicyTopicContentType,
} from "@/tests/content-fixtures";
import {
  BOARD,
  POLICY_PLUGIN_ID,
  policyBoardRows,
  policyReplies,
  policyReplyRow,
  policyTopicRow,
  policyTopics,
} from "@/tests/content-policies";
import { testManifest } from "@/tests/manifest";
import { createPostgresTestSchema, POSTGRES_TEST_URL } from "@/tests/postgres";

import { decideContentSubmission } from "./decide";
import { canReviewSubmission, reviewableContentTypes } from "./queue";
import { openContentSubmission } from "./submissions";

const TOPIC_PENDING = "ptest.topic_pending";
const REPLY_PENDING = "ptest.reply_pending";
const FAMILY = testPolicyBoardContainers.id;

/** A board, a board below it, and an unrelated board. */
const A = BOARD.OPEN;
const A_CHILD = BOARD.OPEN_CHILD;
const B = BOARD.APPROVE;

const ROLE = { MEMBER: 1, MODERATORS: 2, ROOT: 3 } as const;

const USER = {
  AUTHOR: 1,
  /** `can_approve` for topics in A. */
  MOD_A: 10,
  /** `can_approve` for topics in B. */
  MOD_B: 11,
  /** `can_approve` for topics in A and everything below it. */
  MOD_A_TREE: 12,
  /** `can_approve` for topics in every board. */
  MOD_ALL: 13,
  /** `can_approve` for topics without a scope. */
  MOD_UNSCOPED: 14,
  /** Member of a root role. */
  ROOT: 15,
  /** An unrestricted moderator entry. */
  UNRESTRICTED: 16,
  /** A in their own grant and through the MODERATORS secondary role. */
  MOD_ROLE_AND_OWN: 17,
  /** A through MODERATORS as their primary role. */
  MOD_PRIMARY_ROLE: 18,
  /** `can_edit` for topics in A, never `can_approve`. */
  EDIT_ONLY: 19,
  /** `can_approve` for replies in A, not topics. */
  MOD_REPLIES: 20,
  /** `can_approve` for topics in every container of another collection. */
  OTHER_FAMILY: 21,
  /** `can_approve` for topics in A and in B. */
  MOD_AB: 22,
  /** A through MODERATORS as a secondary role only. */
  MOD_SECONDARY_ROLE: 23,
} as const;

const PRIMARY_ROLE: Partial<Record<number, number>> = {
  [USER.ROOT]: ROLE.ROOT,
  [USER.MOD_PRIMARY_ROLE]: ROLE.MODERATORS,
};
const roleOf = (userId: number) => PRIMARY_ROLE[userId] ?? ROLE.MEMBER;

const grant = (
  permission: string,
  scope?: PermissionsStaffArgs["scope"],
  model: typeof policyReplies | typeof policyTopics = policyTopics,
): PermissionsStaffArgs => ({
  module: model.definition.permissionModule,
  permission,
  plugin: POLICY_PLUGIN_ID,
  ...(scope ? { scope } : {}),
});

const approveIn = (...ids: string[]) =>
  grant(CONTENT_PERMISSIONS.approve, { family: FAMILY, ids, mode: "selected" });

const OWN_GRANTS: [number, PermissionsStaffArgs[]][] = [
  [USER.MOD_A, [approveIn(String(A))]],
  [USER.MOD_B, [approveIn(String(B))]],
  [USER.MOD_A_TREE, [approveIn(`${A}:tree`)]],
  [
    USER.MOD_ALL,
    [grant(CONTENT_PERMISSIONS.approve, { family: FAMILY, mode: "all" })],
  ],
  [USER.MOD_UNSCOPED, [grant(CONTENT_PERMISSIONS.approve)]],
  [USER.MOD_ROLE_AND_OWN, [approveIn(String(A))]],
  [
    USER.EDIT_ONLY,
    [
      grant(CONTENT_PERMISSIONS.edit, {
        family: FAMILY,
        ids: [String(A)],
        mode: "selected",
      }),
    ],
  ],
  [
    USER.MOD_REPLIES,
    [
      grant(
        CONTENT_PERMISSIONS.approve,
        { family: FAMILY, ids: [String(A)], mode: "selected" },
        policyReplies,
      ),
    ],
  ],
  [
    USER.OTHER_FAMILY,
    [
      grant(CONTENT_PERMISSIONS.approve, {
        family: "test.other-boards",
        mode: "all",
      }),
    ],
  ],
  [USER.MOD_AB, [approveIn(String(A), String(B))]],
];

const TOPIC = { A: 100, A_CHILD: 101, B: 102, LIVE_A: 103 } as const;
const REPLY_A = 200;

const topicNotifications = buildContentNotifications({
  content: testPolicyTopicContentType,
  rules: {
    pending: {
      id: TOPIC_PENDING,
      preset: "approvalPending",
      messages: {
        label: "ptest.topic_pending.label",
        pending: "ptest.topic_pending.pending",
      },
    },
  },
});

const replyNotifications = buildContentNotifications({
  content: testPolicyReplyContentType,
  root: testPolicyTopicContentType,
  rules: {
    pending: {
      id: REPLY_PENDING,
      preset: "approvalPending",
      messages: {
        label: "ptest.reply_pending.label",
        pending: "ptest.reply_pending.pending",
      },
    },
  },
});

const contentModels = [policyTopics, policyReplies].map(model => ({
  model,
  pluginId: POLICY_PLUGIN_ID,
}));

const plugin = buildApiPlugin({
  manifest: testManifest(POLICY_PLUGIN_ID),
  modules: [],
  contentNotifications: [topicNotifications, replyNotifications],
});

const core = {
  contentModels,
  contentNotifications: createContentNotificationRegistry(
    (plugin.contentNotifications ?? []).map(config => ({
      config,
      pluginId: POLICY_PLUGIN_ID,
    })),
    contentModels,
  ),
  moderation: { scopes: [], targets: [] },
  notifications: createNotificationRegistry(
    (plugin.notificationTypes ?? []).map(definition => ({
      definition,
      pluginId: POLICY_PLUGIN_ID,
    })),
  ),
  permissionStaff: [],
  personalInformationFields: resolvePersonalInformationFields(),
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
  "approval notifications on PostgreSQL",
  () => {
    let schema: PostgresTestSchema;

    /**
     * What the services, the worker and the routes read. A fresh cache every
     * time, so staff permissions always come from the database.
     */
    const setVariables = (c: TestContext, userId: null | number) => {
      c.set("db", schema.db as never);
      c.set("core", core as never);
      c.set("cache", createTestCache());
      c.set("log", log);
      c.set("realtime", { sendToUsers: () => undefined } as never);
      c.set("events", { emit: async () => {} } as never);
      c.set("i18n", i18n as never);
      c.set("admin", null);
      c.set("plugin", { id: POLICY_PLUGIN_ID });
      c.set(
        "user",
        userId === null
          ? null
          : ({
              id: userId,
              language: "en",
              name: `user${userId}`,
              roleId: roleOf(userId),
            } as never),
      );
      c.set("queue", new QueueModel(c));
      const notifications = new NotificationsModel(c);
      // Queued work runs through `drain()`, never in the background.
      vi.spyOn(notifications, "flushAfterResponse").mockImplementation(
        () => undefined,
      );
      c.set("notifications", notifications);
    };

    const contextAs = async (userId: null | number): Promise<TestContext> => {
      let captured: TestContext | undefined;
      const app = new OpenAPIHono<EnvVitNode>();
      app.get("/", c => {
        setVariables(c, userId);
        captured = c;

        return c.body(null, 204);
      });
      await app.request("/");
      if (!captured) throw new Error("no context");

      return captured;
    };

    const routes = new OpenAPIHono<EnvVitNode>();
    routes.use("*", async (c, next) => {
      const header = c.req.header("x-user");
      setVariables(c, header ? Number(header) : null);
      await next();
    });
    routes.onError((error, c) =>
      error instanceof HTTPException
        ? error.getResponse()
        : c.json({ error: String(error) }, 500),
    );
    routes.route("/moderation", moderationModule.hono);

    const showSubmission = async (id: number, userId: number) =>
      await routes.request(`/moderation/approvals/${id}`, {
        headers: { "x-user": String(userId) },
      });

    /** Runs every due queue task - intents, then their fan-out - to the end. */
    const drain = async () => {
      await processQueueTasks(await contextAs(null), {
        lockKey: `test-queue:${Math.random()}`,
      });
    };

    const intents = async () =>
      (
        await schema.db
          .select({ payload: core_queue.payload })
          .from(core_queue)
          .where(eq(core_queue.name, CONTENT_QUEUE_TASK_NOTIFICATIONS))
          .orderBy(asc(core_queue.id))
      ).map(row => row.payload as ContentNotificationIntent);

    const events = async () =>
      await schema.db
        .select({
          actorId: core_notification_events.actorId,
          data: core_notification_events.data,
          idempotencyKey: core_notification_events.idempotencyKey,
          type: core_notification_events.type,
        })
        .from(core_notification_events)
        .orderBy(asc(core_notification_events.id));

    /** Users holding an inbox item of the type, lowest id first. */
    const notified = async (type = TOPIC_PENDING) =>
      (
        await schema.db
          .select({ userId: core_notifications.userId })
          .from(core_notifications)
          .where(eq(core_notifications.type, type))
          .orderBy(asc(core_notifications.userId))
      ).map(row => row.userId);

    const items = async (userId: number, type = TOPIC_PENDING) =>
      await schema.db
        .select()
        .from(core_notifications)
        .where(
          and(
            eq(core_notifications.userId, userId),
            eq(core_notifications.type, type),
          ),
        );

    const inbox = async (userId: number) =>
      (await listNotifications(await contextAs(userId), { limit: 50, userId }))
        .items;

    const UNAVAILABLE = {
      available: false,
      target: null,
      title: "core.notifications.unavailable",
    };

    const modelOf = (kind: "reply" | "topic") =>
      kind === "topic" ? policyTopics : policyReplies;

    /** Opens a submission for an existing record, filed where the record is now. */
    const openIn = async (
      db: ContentDatabase,
      {
        author = USER.AUTHOR,
        id,
        kind = "create",
        type = "topic",
      }: {
        author?: number;
        id: number;
        kind?: "create" | "edit";
        type?: "reply" | "topic";
      },
    ) => {
      const c = await contextAs(author);
      const model = modelOf(type);
      const [row] = (await db
        .select()
        .from(model.table)
        .where(eq(model.table.id, id))) as Record<string, unknown>[];
      const container = await resolveContentRowContainer(
        c,
        db,
        model.definition,
        row,
      );

      return await openContentSubmission(c, db, {
        authorId: author,
        baseUpdatedAt: kind === "edit" ? (row.updatedAt as Date) : null,
        baseVersion: kind === "edit" ? 1 : null,
        container,
        definition: model.definition,
        itemId: id,
        kind,
        pluginId: POLICY_PLUGIN_ID,
        values: kind === "edit" ? { title: "Proposed title" } : {},
      });
    };

    const open = async (args: Parameters<typeof openIn>[1]) =>
      (await schema.db.transaction(async tx => await openIn(tx, args))).row.id;

    const decide = async (id: number, decision: "approve" | "reject") =>
      await decideContentSubmission(await contextAs(USER.ROOT), {
        decision,
        id,
        reason: decision === "reject" ? "Not yet" : null,
        reviewerId: USER.ROOT,
      });

    const setOwnGrants = async (
      userId: number,
      permissions: PermissionsStaffArgs[],
    ) => {
      await schema.db
        .update(core_moderators_permissions)
        .set({ permissions })
        .where(eq(core_moderators_permissions.userId, userId));
    };

    const moveTopic = async (id: number, board: number) => {
      await schema.db
        .update(policyTopics.table)
        .set({ board })
        .where(eq(policyTopics.table.id, id));
    };

    /** Who the queue lets open and decide the submission - the reference. */
    const queueReviewers = async (submissionId: number) => {
      const [row] = await schema.db
        .select()
        .from(core_content_submissions)
        .where(eq(core_content_submissions.id, submissionId));
      const allowed: number[] = [];
      for (const userId of Object.values(USER)) {
        const c = await contextAs(userId);
        const set = await resolveStaffPermissions(c, {
          type: "moderator",
          user: { id: userId, roleId: roleOf(userId) },
        });
        if (canReviewSubmission(await reviewableContentTypes(c, set), row)) {
          allowed.push(userId);
        }
      }

      return allowed.sort((a, b) => a - b);
    };

    beforeAll(async () => {
      schema = await createPostgresTestSchema({
        prefix: "vitnode_approval_notifications",
        tables: {
          test_policy_replies: policyReplies.table,
          test_policy_topics: policyTopics.table,
        },
      });
      await schema.db
        .insert(core_languages)
        .values({ code: "en", name: "English" });
      await schema.db.insert(core_roles).values([
        { id: ROLE.MEMBER, updatedAt: new Date() },
        { id: ROLE.MODERATORS, updatedAt: new Date() },
        { id: ROLE.ROOT, root: true, updatedAt: new Date() },
      ]);
      await schema.db.insert(core_users).values(
        Object.values(USER).map(id => ({
          avatarColor: "000000",
          email: `user${id}@example.com`,
          id,
          ipAddress: "127.0.0.1",
          name: `user${id}`,
          nameCode: `user${id}`,
          roleId: roleOf(id),
        })),
      );
      await schema.db.insert(core_users_secondary_roles).values(
        [USER.MOD_ROLE_AND_OWN, USER.MOD_SECONDARY_ROLE].map(userId => ({
          roleId: ROLE.MODERATORS,
          userId,
        })),
      );
      await schema.db.insert(core_content_containers).values(policyBoardRows());
    }, 120_000);

    afterAll(async () => {
      await schema?.drop();
    });

    beforeEach(async () => {
      vi.restoreAllMocks();
      await schema.client.unsafe(
        `truncate test_policy_replies, test_policy_topics, core_queue,
          core_notification_events, core_notifications, core_notification_receipts,
          core_notification_deliveries, core_notification_user_state,
          core_content_submissions, core_content_revisions,
          core_moderators_permissions restart identity cascade`,
      );
      await schema.db.insert(core_moderators_permissions).values([
        ...OWN_GRANTS.map(([userId, permissions]) => ({
          permissions,
          userId,
        })),
        { permissions: [approveIn(String(A))], roleId: ROLE.MODERATORS },
        { permissions: [], unrestricted: true, userId: USER.UNRESTRICTED },
      ]);
      await schema.db.insert(policyTopics.table).values([
        policyTopicRow(TOPIC.A, A, {
          author: USER.AUTHOR,
          publishedAt: null,
          status: "draft",
        }),
        policyTopicRow(TOPIC.A_CHILD, A_CHILD, {
          author: USER.AUTHOR,
          publishedAt: null,
          status: "draft",
        }),
        policyTopicRow(TOPIC.B, B, {
          author: USER.AUTHOR,
          publishedAt: null,
          status: "draft",
        }),
        policyTopicRow(TOPIC.LIVE_A, A, { author: USER.AUTHOR }),
      ] as never);
      await schema.db.insert(policyReplies.table).values(
        policyReplyRow(REPLY_A, TOPIC.LIVE_A, {
          author: USER.AUTHOR,
          publishedAt: null,
          status: "draft",
        }) as never,
      );
    });

    describe("recipients", () => {
      const TOPIC_A_REVIEWERS = [
        USER.MOD_A,
        USER.MOD_A_TREE,
        USER.MOD_ALL,
        USER.MOD_UNSCOPED,
        USER.ROOT,
        USER.UNRESTRICTED,
        USER.MOD_ROLE_AND_OWN,
        USER.MOD_PRIMARY_ROLE,
        USER.MOD_AB,
        USER.MOD_SECONDARY_ROLE,
      ];

      it.each<
        [
          string,
          Parameters<typeof openIn>[1],
          { type: string; users: number[] },
        ]
      >([
        [
          "a new topic in A reaches A's, A-subtree, all-board, unscoped, root, unrestricted and role moderators",
          { id: TOPIC.A },
          { type: TOPIC_PENDING, users: TOPIC_A_REVIEWERS },
        ],
        [
          "a topic edit in A reaches the same moderators",
          { id: TOPIC.LIVE_A, kind: "edit" },
          { type: TOPIC_PENDING, users: TOPIC_A_REVIEWERS },
        ],
        [
          "a topic in a child of A skips moderators of A alone",
          { id: TOPIC.A_CHILD },
          {
            type: TOPIC_PENDING,
            users: [
              USER.MOD_A_TREE,
              USER.MOD_ALL,
              USER.MOD_UNSCOPED,
              USER.ROOT,
              USER.UNRESTRICTED,
            ].sort((a, b) => a - b),
          },
        ],
        [
          "a topic in B reaches B's moderators, not A's",
          { id: TOPIC.B },
          {
            type: TOPIC_PENDING,
            users: [
              USER.MOD_B,
              USER.MOD_ALL,
              USER.MOD_UNSCOPED,
              USER.ROOT,
              USER.UNRESTRICTED,
              USER.MOD_AB,
            ].sort((a, b) => a - b),
          },
        ],
        [
          "a reply in A reaches reply approvers only - topic approval does not cover it",
          { id: REPLY_A, type: "reply" },
          {
            type: REPLY_PENDING,
            users: [USER.ROOT, USER.UNRESTRICTED, USER.MOD_REPLIES],
          },
        ],
        [
          "the submitter never hears about their own submission, even as a moderator",
          { author: USER.MOD_A, id: TOPIC.A },
          {
            type: TOPIC_PENDING,
            users: TOPIC_A_REVIEWERS.filter(id => id !== USER.MOD_A),
          },
        ],
      ])("%s", async (_, submission, expected) => {
        const id = await open(submission);
        await drain();

        await expect(notified(expected.type)).resolves.toEqual(
          [...expected.users].sort((a, b) => a - b),
        );
        // Exactly whom the queue lets open and decide it, minus the submitter.
        expect(
          (await queueReviewers(id)).filter(
            userId => userId !== (submission.author ?? USER.AUTHOR),
          ),
        ).toEqual([...expected.users].sort((a, b) => a - b));
      });

      it("gives a moderator qualifying by role and by own grant one item from one receipt", async () => {
        await open({ id: TOPIC.A });
        await drain();

        await expect(items(USER.MOD_ROLE_AND_OWN)).resolves.toMatchObject([
          { eventCount: 1 },
        ]);
        await expect(
          schema.db
            .select()
            .from(core_notification_receipts)
            .where(
              eq(core_notification_receipts.userId, USER.MOD_ROLE_AND_OWN),
            ),
        ).resolves.toHaveLength(1);
      });

      it("links each moderator to the submission and names the board, never the content", async () => {
        const topic = await open({ id: TOPIC.A });
        const reply = await open({ id: REPLY_A, type: "reply" });
        await drain();

        const published = await events();
        expect(published).toHaveLength(2);
        expect(published).toEqual(
          expect.arrayContaining([
            {
              actorId: USER.AUTHOR,
              data: {
                container: "Board 1",
                contentId: String(TOPIC.A),
                contentTypeId: testPolicyTopicContentType.id,
                kind: "create",
                rootId: null,
                submissionId: topic,
              },
              idempotencyKey: `approval:${testPolicyTopicContentType.id}:${topic}`,
              type: TOPIC_PENDING,
            },
            {
              actorId: USER.AUTHOR,
              data: {
                container: "Board 1",
                contentId: String(REPLY_A),
                contentTypeId: testPolicyReplyContentType.id,
                kind: "create",
                rootId: String(TOPIC.LIVE_A),
                submissionId: reply,
              },
              idempotencyKey: `approval:${testPolicyReplyContentType.id}:${reply}`,
              type: REPLY_PENDING,
            },
          ]),
        );
        const delivered = (await inbox(USER.ROOT)).map(
          ({ available, target, title }) => ({ available, target, title }),
        );
        expect(delivered).toHaveLength(2);
        expect(delivered).toEqual(
          expect.arrayContaining([
            {
              available: true,
              target: `/modcp/approvals/${reply}`,
              title: "ptest.reply_pending.pending",
            },
            {
              available: true,
              target: `/modcp/approvals/${topic}`,
              title: "ptest.topic_pending.pending",
            },
          ]),
        );
      });
    });

    describe("before the worker runs", () => {
      it.each<[string, (id: number) => Promise<unknown>]>([
        ["approved", async id => await decide(id, "approve")],
        ["rejected", async id => await decide(id, "reject")],
        [
          "cancelled because the record is gone",
          async id => {
            await schema.db
              .delete(policyTopics.table)
              .where(eq(policyTopics.table.id, TOPIC.A));
            await expect(decide(id, "approve")).rejects.toMatchObject({
              code: "gone",
            });
          },
        ],
        [
          "superseded by the author's newer proposal",
          async () => await open({ id: TOPIC.A }),
        ],
      ])("announces nothing about a submission %s", async (_, change) => {
        const id = await open({ id: TOPIC.A });
        const [intent] = await intents();

        await change(id);

        await expect(
          processContentNotificationIntent(await contextAs(null), intent),
        ).resolves.toEqual({ reason: "stale_submission", status: "skipped" });
        await drain();
        expect(
          (await events()).filter(
            event =>
              (event.data as { submissionId: number }).submissionId === id,
          ),
        ).toEqual([]);
        // Nothing was published, so nothing needs cleaning up.
        expect(
          (await intents()).filter(
            entry => entry.trigger === "approvalResolved",
          ),
        ).toEqual([]);
      });

      it("announces only the newer submission when one supersedes another", async () => {
        const first = await open({ id: TOPIC.LIVE_A, kind: "edit" });
        const second = await open({ id: TOPIC.LIVE_A, kind: "edit" });
        await drain();

        expect(first).not.toBe(second);
        await expect(events()).resolves.toEqual([
          expect.objectContaining({
            data: expect.objectContaining({ submissionId: second }),
          }),
        ]);
        await expect(items(USER.MOD_A)).resolves.toHaveLength(1);
      });

      it.each<[string, () => Promise<void>]>([
        [
          "the grant is revoked",
          async () => {
            await schema.db
              .delete(core_moderators_permissions)
              .where(eq(core_moderators_permissions.userId, USER.MOD_A));
          },
        ],
        [
          "the grant is narrowed to can_edit",
          async () => {
            await setOwnGrants(USER.MOD_A, [
              grant(CONTENT_PERMISSIONS.edit, {
                family: FAMILY,
                ids: [String(A)],
                mode: "selected",
              }),
            ]);
          },
        ],
      ])("skips a moderator when %s", async (_, revoke) => {
        await open({ id: TOPIC.A });

        await revoke();
        await drain();

        await expect(items(USER.MOD_A)).resolves.toEqual([]);
        await expect(items(USER.MOD_ALL)).resolves.toHaveLength(1);
      });

      it("requires the board the queue lists it in and the one the record moved to", async () => {
        await open({ id: TOPIC.A });

        await moveTopic(TOPIC.A, B);
        await drain();

        // Moderators of only A could open it but not decide it; moderators of
        // only B could decide it but the queue does not list it for them.
        await expect(notified()).resolves.toEqual(
          [
            USER.MOD_ALL,
            USER.MOD_UNSCOPED,
            USER.ROOT,
            USER.UNRESTRICTED,
            USER.MOD_AB,
          ].sort((a, b) => a - b),
        );
        await expect(events()).resolves.toEqual([
          expect.objectContaining({
            data: expect.objectContaining({ container: `Board ${B}` }),
          }),
        ]);
      });

      it("leaves no intent and no notification when the opening transaction rolls back", async () => {
        await expect(
          schema.db.transaction(async tx => {
            await openIn(tx, { id: TOPIC.A });
            throw new Error("rolled back");
          }),
        ).rejects.toThrow("rolled back");

        await expect(intents()).resolves.toEqual([]);
        await expect(
          schema.db.select().from(core_content_submissions),
        ).resolves.toEqual([]);
        await drain();
        await expect(events()).resolves.toEqual([]);
      });
    });

    describe("reliability", () => {
      it("publishes once however often the intent is processed", async () => {
        await open({ id: TOPIC.A });
        const [intent] = await intents();

        await expect(
          processContentNotificationIntent(await contextAs(null), intent),
        ).resolves.toEqual({ published: 1, status: "processed" });
        await processContentNotificationIntent(await contextAs(null), intent);
        await drain();
        await processContentNotificationIntent(await contextAs(null), intent);
        await drain();

        await expect(events()).resolves.toHaveLength(1);
        await expect(items(USER.MOD_A)).resolves.toMatchObject([
          { eventCount: 1 },
        ]);
      });

      it("publishes nothing when the submission is decided while recipients are resolved", async () => {
        const id = await open({ id: TOPIC.A });
        const [intent] = await intents();
        const transaction = schema.db.transaction.bind(schema.db);
        // The worker's only transaction is the publishing one: decide first.
        vi.spyOn(schema.db, "transaction").mockImplementationOnce(
          async (run, config) => {
            await decide(id, "approve");

            return await transaction(run, config);
          },
        );

        await expect(
          processContentNotificationIntent(await contextAs(null), intent),
        ).resolves.toEqual({ reason: "stale_submission", status: "skipped" });
        await drain();

        await expect(events()).resolves.toEqual([]);
        await expect(
          schema.db.select().from(core_content_submissions),
        ).resolves.toMatchObject([{ id, status: "approved" }]);
      });

      it("removes the items of a submission decided while its event is published", async () => {
        const id = await open({ id: TOPIC.A });
        const [intent] = await intents();
        const c = await contextAs(null);
        const notifications = c.get("notifications");
        const publish = notifications.publish.bind(notifications);
        let decision: Promise<unknown> | undefined;
        vi.spyOn(notifications, "publish").mockImplementation(async args => {
          const result = await publish(args);
          decision = decide(id, "approve");
          // Until the decision waits on the submission row the worker holds.
          for (let attempt = 0; attempt < 10_000; attempt += 1) {
            const [{ waiting }] = await schema.client<{ waiting: number }[]>`
              select count(*)::int as waiting from pg_stat_activity
              where datname = current_database() and wait_event_type = 'Lock'`;
            if (waiting > 0) break;
          }

          return result;
        });

        await expect(
          processContentNotificationIntent(c, intent),
        ).resolves.toEqual({ published: 1, status: "processed" });
        await expect(decision).resolves.toMatchObject({ status: "approved" });
        // The decision waited for the event, so it saw it and cleans it up.
        await expect(intents()).resolves.toContainEqual(
          expect.objectContaining({
            submissionId: id,
            trigger: "approvalResolved",
          }),
        );
        await drain();

        await expect(events()).resolves.toHaveLength(1);
        await expect(notified()).resolves.toEqual([]);
      });

      it("announces a resubmission after a rejection again", async () => {
        const first = await open({ id: TOPIC.A });
        await drain();
        await decide(first, "reject");
        await drain();

        const second = await open({ id: TOPIC.A });
        await drain();

        await expect(events()).resolves.toMatchObject([
          { data: { submissionId: first } },
          { data: { submissionId: second } },
        ]);
        await expect(inbox(USER.MOD_A)).resolves.toMatchObject([
          { available: true, target: `/modcp/approvals/${second}` },
        ]);
      });
    });

    describe("after delivery", () => {
      it.each<[string, (id: number) => Promise<unknown>]>([
        [
          "approved",
          async id => {
            await expect(decide(id, "approve")).resolves.toMatchObject({
              status: "approved",
            });
          },
        ],
        [
          "rejected",
          async id => {
            await expect(decide(id, "reject")).resolves.toMatchObject({
              status: "rejected",
            });
          },
        ],
        [
          "cancelled because the record is gone",
          async id => {
            await schema.db
              .delete(policyTopics.table)
              .where(eq(policyTopics.table.id, TOPIC.A));
            await expect(decide(id, "approve")).rejects.toMatchObject({
              code: "gone",
            });
          },
        ],
      ])(
        "removes every moderator's item once the submission is %s",
        async (_, change) => {
          const id = await open({ id: TOPIC.A });
          await drain();
          await expect(notified()).resolves.toHaveLength(10);
          await expect(
            (await contextAs(USER.MOD_A))
              .get("notifications")
              .state(USER.MOD_A),
          ).resolves.toMatchObject({ unread: 1 });

          await change(id);
          await expect(intents()).resolves.toContainEqual(
            expect.objectContaining({
              submissionId: id,
              trigger: "approvalResolved",
            }),
          );
          await drain();

          await expect(notified()).resolves.toEqual([]);
          await expect(
            (await contextAs(USER.MOD_A))
              .get("notifications")
              .state(USER.MOD_A),
          ).resolves.toMatchObject({ unread: 0 });
        },
      );

      it("removes the items of a record deleted while it waits", async () => {
        await open({ id: REPLY_A, type: "reply" });
        await drain();
        await expect(notified(REPLY_PENDING)).resolves.toHaveLength(3);

        await policyReplies
          .service(await contextAs(USER.AUTHOR))
          .delete(REPLY_A);
        await drain();

        await expect(notified(REPLY_PENDING)).resolves.toEqual([]);
      });

      it("swaps the item for the newer proposal when the author supersedes it", async () => {
        const first = await open({ id: TOPIC.LIVE_A, kind: "edit" });
        await drain();

        const second = await open({ id: TOPIC.LIVE_A, kind: "edit" });
        await drain();

        await expect(inbox(USER.MOD_A)).resolves.toMatchObject([
          { available: true, target: `/modcp/approvals/${second}` },
        ]);
        expect(
          (await inbox(USER.MOD_A)).map(item => item.target),
        ).not.toContain(`/modcp/approvals/${first}`);
      });

      it("shows a placeholder to a moderator who lost can_approve, whose link answers 404", async () => {
        const id = await open({ id: TOPIC.A });
        await drain();
        await expect(inbox(USER.MOD_A)).resolves.toMatchObject([
          { available: true, target: `/modcp/approvals/${id}` },
        ]);
        expect((await showSubmission(id, USER.MOD_A)).status).toBe(200);

        await setOwnGrants(USER.MOD_A, [
          grant(CONTENT_PERMISSIONS.edit, {
            family: FAMILY,
            ids: [String(A)],
            mode: "selected",
          }),
        ]);

        await expect(inbox(USER.MOD_A)).resolves.toMatchObject([UNAVAILABLE]);
        expect((await showSubmission(id, USER.MOD_A)).status).toBe(404);
        await expect(inbox(USER.MOD_ALL)).resolves.toMatchObject([
          { available: true },
        ]);
      });

      it("shows a placeholder to a moderator of the old board once the record moves", async () => {
        await open({ id: TOPIC.A });
        await drain();

        await moveTopic(TOPIC.A, B);

        await expect(inbox(USER.MOD_A)).resolves.toMatchObject([UNAVAILABLE]);
        await expect(inbox(USER.MOD_AB)).resolves.toMatchObject([
          { available: true },
        ]);
      });
    });
  },
);
