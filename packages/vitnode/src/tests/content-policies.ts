import type { Table } from "drizzle-orm";
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { moderationModule } from "@/api/modules/moderation/moderation.module";
import { CONTENT_PERMISSIONS } from "@/content/const";
import { createContentModel } from "@/content/server/model";
import { buildContentPublicRoutes } from "@/content/server/public-routes";
import { core_content_revisions } from "@/database/content";
import { core_content_containers } from "@/database/content-containers";
import { core_content_submissions } from "@/database/content-submissions";
import { core_files } from "@/database/files";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import { createTestCache } from "@/tests/cache";
import {
  testPolicyBoardContainers,
  testPolicyReplyContentType,
  testPolicyTopicContentType,
} from "@/tests/content-fixtures";
import { createMemoryDb } from "@/tests/memory-db";
import {
  grantStaffPermissions,
  ROOT_STAFF_PERMISSIONS,
} from "@/tests/staff-permissions";

/**
 * One world for the container policy, approval and thread route tests: a board
 * collection with policies, topics filed in a board, replies filed in their
 * topic's board, and moderators scoped to some of the boards.
 */
export const POLICY_PLUGIN_ID = "@vitnode/example";

export const policyTopics = createContentModel(testPolicyTopicContentType);
export const policyReplies = createContentModel(testPolicyReplyContentType, {
  references: { topic: () => policyTopics.table.id },
});

const FAMILY = testPolicyBoardContainers.id;
const TOPIC_TYPE = testPolicyTopicContentType.id;
const REPLY_TYPE = testPolicyReplyContentType.id;

export const BOARD = {
  /** Immediate everything, from the definition defaults. */
  OPEN: 1,
  /** Below OPEN, no overrides of its own. */
  OPEN_CHILD: 2,
  /** New topics and replies, and topic edits, wait for a moderator. */
  APPROVE: 3,
  /** Only `can_edit` holders start topics here. */
  MODERATORS: 4,
  /** Authors never edit their topics here. */
  LOCKED: 5,
} as const;

export const USER = {
  MEMBER: 1,
  OTHER_MEMBER: 2,
  /** `can_edit` and `can_approve` in OPEN only - not below it. */
  MOD_OPEN: 10,
  /** `can_approve` in OPEN and everything below it. */
  MOD_OPEN_TREE: 11,
  /** `can_edit` and `can_approve` in APPROVE. */
  MOD_APPROVE: 12,
  ROOT: 99,
} as const;

const MEMBER_ROLE = 3;

export const POLICY_LIVE = new Date("2026-09-01T10:00:00.000Z");

const scoped = (
  permission: string,
  ids: string[],
  contentTypes = [policyTopics, policyReplies],
): PermissionsStaffArgs[] =>
  contentTypes.map(model => ({
    module: model.definition.permissionModule,
    permission,
    plugin: POLICY_PLUGIN_ID,
    scope: { family: FAMILY, ids, mode: "selected" },
  }));

const GRANTS: [
  number,
  Parameters<typeof grantStaffPermissions>[1]["permissions"],
][] = [
  [USER.MEMBER, { permissions: [], root: false, staff: false }],
  [USER.OTHER_MEMBER, { permissions: [], root: false, staff: false }],
  [
    USER.MOD_OPEN,
    [
      ...scoped(CONTENT_PERMISSIONS.edit, [String(BOARD.OPEN)]),
      ...scoped(CONTENT_PERMISSIONS.approve, [String(BOARD.OPEN)]),
    ],
  ],
  [
    USER.MOD_OPEN_TREE,
    scoped(CONTENT_PERMISSIONS.approve, [`${BOARD.OPEN}:tree`]),
  ],
  [
    USER.MOD_APPROVE,
    [
      ...scoped(CONTENT_PERMISSIONS.edit, [String(BOARD.APPROVE)]),
      ...scoped(CONTENT_PERMISSIONS.approve, [String(BOARD.APPROVE)]),
    ],
  ],
  [USER.ROOT, ROOT_STAFF_PERMISSIONS],
];

const board = (
  id: number,
  parentId: null | number,
  policies: Record<string, Record<string, unknown>> = {},
) => ({
  createdAt: POLICY_LIVE,
  definitionId: FAMILY,
  id,
  metadata: {},
  name: `Board ${id}`,
  parentId,
  pluginId: POLICY_PLUGIN_ID,
  policies,
  position: id,
  slug: `board-${id}`,
  updatedAt: POLICY_LIVE,
});

export const policyBoardRows = () => [
  board(BOARD.OPEN, null),
  board(BOARD.OPEN_CHILD, BOARD.OPEN),
  board(BOARD.APPROVE, null, {
    [TOPIC_TYPE]: { edits: "approve", publish: "approve" },
    [REPLY_TYPE]: { publish: "approve" },
  }),
  board(BOARD.MODERATORS, null, { [TOPIC_TYPE]: { create: "moderators" } }),
  board(BOARD.LOCKED, null, { [TOPIC_TYPE]: { authorEdit: "never" } }),
];

export const policyTopicRow = (
  id: number,
  boardId: number,
  overrides: Record<string, unknown> = {},
) => ({
  author: USER.MEMBER,
  board: boardId,
  createdAt: POLICY_LIVE,
  hiddenAt: null,
  hiddenBy: null,
  id,
  publishedAt: POLICY_LIVE,
  slug: `topic-${id}`,
  status: "published",
  title: `Topic ${id}`,
  updatedAt: POLICY_LIVE,
  version: 1,
  ...overrides,
});

export const policyReplyRow = (
  id: number,
  topic: number,
  overrides: Record<string, unknown> = {},
) => ({
  author: USER.MEMBER,
  body: `Reply ${id}`,
  createdAt: new Date(POLICY_LIVE.getTime() + id * 60_000),
  hiddenAt: null,
  hiddenBy: null,
  id,
  parent: null,
  publishedAt: POLICY_LIVE,
  slug: `reply-${id}`,
  status: "published",
  topic,
  updatedAt: POLICY_LIVE,
  ...overrides,
});

export const createPolicyWorld = async ({
  replies = [],
  submissions = [],
  topics = [],
}: {
  replies?: readonly object[];
  submissions?: readonly object[];
  topics?: readonly object[];
} = {}) => {
  const users = Object.values(USER);
  const memory = createMemoryDb([
    [core_content_containers, policyBoardRows()],
    [policyTopics.table, topics],
    [policyReplies.table, replies],
    [core_content_submissions, submissions],
    [core_content_revisions, []],
    [
      core_users,
      users.map(id => ({
        avatarColor: "000000",
        avatarId: null,
        email: `${id}@example.com`,
        id,
        name: `User ${id}`,
        nameCode: `user-${id}`,
        roleId: MEMBER_ROLE,
      })),
    ],
    [core_roles, [{ color: null, id: MEMBER_ROLE, prefix: null }]],
    [core_files, []],
  ] as [Table, readonly object[]][]);

  const cache = createTestCache();
  for (const [userId, permissions] of GRANTS) {
    await grantStaffPermissions(cache, {
      permissions,
      type: "moderator",
      userId,
    });
  }

  const emitted: { name: string; payload: Record<string, unknown> }[] = [];

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    const header = c.req.header("x-user");
    c.set(
      "user",
      (header
        ? { id: Number(header), roleId: MEMBER_ROLE }
        : null) as unknown as Context["var"]["user"],
    );
    c.set("cache", cache);
    c.set("db", memory.db as unknown as Context["var"]["db"]);
    c.set("events", {
      emit: async (name: string, payload: Record<string, unknown>) => {
        emitted.push({ name, payload });

        return await Promise.resolve({
          delivered: 0,
          eventId: "event",
          failures: [],
        });
      },
    } as unknown as Context["var"]["events"]);
    c.set("core", {
      contentModels: [
        { model: policyTopics, pluginId: POLICY_PLUGIN_ID },
        { model: policyReplies, pluginId: POLICY_PLUGIN_ID },
      ],
      moderation: { scopes: [], targets: [] },
      permissionStaff: [],
    } as unknown as Context["var"]["core"]);
    await next();
  });
  app.onError((error, c) =>
    error instanceof HTTPException
      ? error.getResponse()
      : c.json({ error: String(error) }, 500),
  );

  for (const [path, model] of [
    ["/topics", policyTopics],
    ["/replies", policyReplies],
  ] as const) {
    const sub = new OpenAPIHono();
    for (const { handler, route } of buildContentPublicRoutes(model as never, {
      pluginId: POLICY_PLUGIN_ID,
    })) {
      sub.openapi(route, handler);
    }
    app.route(path, sub);
  }
  app.route("/moderation", moderationModule.hono);

  const send = async (
    method: string,
    path: string,
    { body, user }: { body?: unknown; user?: number } = {},
  ) =>
    await app.request(path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(user === undefined ? {} : { "x-user": String(user) }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  return {
    emitted,
    events: () => emitted.map(event => event.name),
    memory,
    rows: (table: Table) => memory.rows(table),
    send,
    submissions: () => memory.rows(core_content_submissions),
  };
};

export type PolicyWorld = Awaited<ReturnType<typeof createPolicyWorld>>;
