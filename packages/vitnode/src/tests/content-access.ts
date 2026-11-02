import type { Table } from "drizzle-orm";
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type { ContentAccessOverrides } from "@/content/access/policy";

import { contentFileDownloadRoute } from "@/content/access/server/download-route";
import { defineContentContainer } from "@/content/containers/define";
import { buildContentContainerPublicRoutes } from "@/content/containers/server/public-routes";
import { defineContentType } from "@/content/define";
import { field } from "@/content/fields";
import { createContentModel } from "@/content/server/model";
import { buildContentPublicRoutes } from "@/content/server/public-routes";
import {
  core_content_access_rule_roles,
  core_content_access_rules,
} from "@/database/content-access";
import { core_content_containers } from "@/database/content-containers";
import { core_files } from "@/database/files";
import { core_roles } from "@/database/roles";
import { core_users, core_users_secondary_roles } from "@/database/users";
import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";
import { grantStaffPermissions } from "@/tests/staff-permissions";

/**
 * One world for the access rule tests: a nested board collection with access
 * rules, topics filed in a board (with an attachment), replies that follow
 * their topic, and a flat category scope type - with members, a VIP role held
 * as a secondary role, and a root administrator.
 */
export const ACCESS_PLUGIN_ID = "@vitnode/example";

export const testAccessBoards = defineContentContainer({
  id: "test.access-boards",
  hierarchy: { maxDepth: 4 },
  access: true,
  publicApi: { path: "access-boards" },
});

export const testAccessTopicContentType = defineContentType({
  id: "test.access-topic",
  tableName: "test_access_topics",
  publication: true,
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    slug: field.slug({ source: "title" }),
    author: field.user(),
    board: field.container({ definition: testAccessBoards, required: true }),
    attachment: field.file({ maxBytes: 10_000, nullable: true }),
  },
  publicApi: {
    path: "access-topics",
    fields: ["id", "title", "slug", "board", "publishedAt"],
    filterableFields: ["board"],
    orderableFields: ["publishedAt"],
    defaultOrderBy: "publishedAt",
    defaultOrder: "asc",
  },
});

export const testAccessReplyContentType = defineContentType({
  id: "test.access-reply",
  tableName: "test_access_replies",
  publication: true,
  fields: {
    slug: field.slug({ generated: true }),
    body: field.text({ required: true, maxLength: 2000 }),
    author: field.user(),
    topic: field.relation({
      target: () => testAccessTopicContentType,
      required: true,
      container: true,
      onDelete: "cascade",
    }),
  },
  publicApi: {
    path: "access-replies",
    fields: ["id", "slug", "body", "topic", "publishedAt"],
  },
  publicWrite: {
    ownership: { field: "author" },
    create: { fields: ["body", "topic"], status: "published" },
  },
});

/** Filed in a board, with files in a file field and in rich text. */
export const testAccessArticleContentType = defineContentType({
  id: "test.access-article",
  tableName: "test_access_articles",
  publication: true,
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    slug: field.slug({ source: "title" }),
    board: field.container({ definition: testAccessBoards, required: true }),
    attachment: field.file({ maxBytes: 10_000, nullable: true }),
    body: field.richText({ maxBytes: 10_000, nullable: true }),
  },
  publicApi: {
    path: "access-articles",
    fields: ["id", "title", "slug", "board", "attachment", "body"],
  },
});

/** A flat scope type, like a Blog category. */
export const testAccessCategoryContentType = defineContentType({
  id: "test.access-category",
  tableName: "test_access_categories",
  fields: { title: field.text({ required: true, maxLength: 100 }) },
  access: { scope: true },
});

export const accessTopics = createContentModel(testAccessTopicContentType);
export const accessReplies = createContentModel(testAccessReplyContentType, {
  references: { topic: () => accessTopics.table.id },
});
export const accessArticles = createContentModel(testAccessArticleContentType);
export const accessCategories = createContentModel(
  testAccessCategoryContentType,
);

export const ROLE = { GUEST: 2, MEMBER: 3, ROOT: 1, VIP: 4 } as const;

export const USER = {
  MEMBER: 1,
  /** The member role, plus VIP as a secondary role. */
  VIP: 2,
  ROOT: 9,
} as const;

export const BOARD = {
  OPEN: 1,
  /** View: signed-in members. */
  MEMBERS: 2,
  /** Below MEMBERS. View: the VIP role. */
  VIP: 3,
  /** View: everyone. Read: signed-in members. Downloads: the VIP role. */
  READERS: 4,
  /** Below OPEN, no rules of its own. */
  OPEN_CHILD: 5,
} as const;

/** One topic per board, its id the board's plus ten. */
export const TOPIC = {
  OPEN: 11,
  MEMBERS: 12,
  VIP: 13,
  READERS: 14,
  OPEN_CHILD: 15,
} as const;

/** An article in READERS: a member reads it, only VIP downloads from it. */
export const ARTICLE = 24;

export const CATEGORY = {
  /** Read: signed-in members. */
  MEMBERS: 1,
  /** Read: the VIP role. */
  VIP: 2,
} as const;

export const FILE = { IMAGE: 51, PDF: 50, ELSEWHERE: 52 } as const;

const LIVE = new Date("2026-09-01T10:00:00.000Z");

const board = (id: number, parentId: null | number) => ({
  createdAt: LIVE,
  definitionId: testAccessBoards.id,
  id,
  metadata: {},
  name: `Board ${id}`,
  parentId,
  pluginId: ACCESS_PLUGIN_ID,
  position: id,
  slug: `board-${id}`,
  updatedAt: LIVE,
});

const topic = (id: number, boardId: number) => ({
  attachment: FILE.PDF,
  author: USER.MEMBER,
  board: boardId,
  createdAt: LIVE,
  id,
  publishedAt: new Date(LIVE.getTime() + id * 60_000),
  slug: `topic-${id}`,
  status: "published",
  title: `Topic ${id}`,
  updatedAt: LIVE,
});

type Rules = Record<string, Record<string, ContentAccessOverrides>>;

/** The rules every test starts from, by family then scope. */
export const ACCESS_RULES: Rules = {
  [testAccessBoards.id]: {
    [BOARD.MEMBERS]: { view: { mode: "members" } },
    [BOARD.VIP]: { view: { mode: "roles", roleIds: [ROLE.VIP] } },
    [BOARD.READERS]: {
      downloadAttachments: { mode: "roles", roleIds: [ROLE.VIP] },
      read: { mode: "members" },
    },
  },
  [testAccessCategoryContentType.id]: {
    [CATEGORY.MEMBERS]: { read: { mode: "members" } },
    [CATEGORY.VIP]: { read: { mode: "roles", roleIds: [ROLE.VIP] } },
  },
};

const ruleRows = (rules: Rules) => {
  const rows: Record<string, unknown>[] = [];
  const roles: { roleId: number; ruleId: number }[] = [];
  for (const [family, scopes] of Object.entries(rules)) {
    for (const [scopeId, overrides] of Object.entries(scopes)) {
      for (const [action, audience] of Object.entries(overrides)) {
        const id = rows.length + 1;
        rows.push({ action, family, id, mode: audience.mode, scopeId });
        if (audience.mode === "roles") {
          roles.push(
            ...audience.roleIds.map(roleId => ({ roleId, ruleId: id })),
          );
        }
      }
    }
  }

  return { roles, rows };
};

export interface AccessWorldOptions {
  /** Whether the storage adapter has a private store. Defaults to `true`. */
  privateStorage?: boolean;
  rules?: Rules;
}

export const createAccessWorld = async ({
  privateStorage = true,
  rules = ACCESS_RULES,
}: AccessWorldOptions = {}) => {
  const { roles, rows } = ruleRows(rules);
  const memory = createMemoryDb([
    [
      core_content_containers,
      [
        board(BOARD.OPEN, null),
        board(BOARD.MEMBERS, null),
        board(BOARD.VIP, BOARD.MEMBERS),
        board(BOARD.READERS, null),
        board(BOARD.OPEN_CHILD, BOARD.OPEN),
      ],
    ],
    [
      accessTopics.table,
      Object.entries(TOPIC).map(([key, id]) =>
        topic(id, BOARD[key as keyof typeof BOARD]),
      ),
    ],
    [accessReplies.table, []],
    [
      accessArticles.table,
      [
        {
          attachment: FILE.PDF,
          body: null,
          board: BOARD.READERS,
          id: ARTICLE,
          publishedAt: LIVE,
          slug: "article",
          status: "published",
          title: "Article",
        },
      ],
    ],
    [
      accessCategories.table,
      Object.values(CATEGORY).map(id => ({ id, title: `Category ${id}` })),
    ],
    [core_content_access_rules, rows],
    [core_content_access_rule_roles, roles],
    [
      core_roles,
      [
        { guest: false, id: ROLE.ROOT, root: true },
        { guest: true, id: ROLE.GUEST, root: false },
        { guest: false, id: ROLE.MEMBER, root: false },
        { guest: false, id: ROLE.VIP, root: false },
      ],
    ],
    [
      core_users,
      [
        { id: USER.MEMBER, roleId: ROLE.MEMBER },
        { id: USER.VIP, roleId: ROLE.MEMBER },
        { id: USER.ROOT, roleId: ROLE.ROOT },
      ].map(user => ({
        ...user,
        avatarColor: "000000",
        email: `${user.id}@example.com`,
        name: `User ${user.id}`,
        nameCode: `user-${user.id}`,
      })),
    ],
    [core_users_secondary_roles, [{ roleId: ROLE.VIP, userId: USER.VIP }]],
    [
      core_files,
      [
        {
          id: FILE.PDF,
          key: "a.pdf",
          mimeType: "application/pdf",
          name: "a.pdf",
          size: 3,
          visibility: "private",
        },
        {
          id: FILE.IMAGE,
          key: "b.png",
          mimeType: "image/png",
          name: "b.png",
          size: 3,
          visibility: "private",
        },
        {
          id: FILE.ELSEWHERE,
          key: "c.pdf",
          mimeType: "application/pdf",
          name: "c.pdf",
          size: 3,
          visibility: "private",
        },
      ],
    ],
  ] as [Table, readonly object[]][]);

  const cache = createTestCache();
  for (const userId of Object.values(USER)) {
    await grantStaffPermissions(cache, {
      permissions: { permissions: [], root: false, staff: false },
      type: "moderator",
      userId,
    });
  }

  const emitted: { name: string; payload: Record<string, unknown> }[] = [];
  const opened: string[] = [];
  const storage = {
    openFile: async ({ key }: { key: string }) => {
      opened.push(key);

      return await Promise.resolve({
        body: new Blob(["pdf"]).stream(),
        size: 3,
      });
    },
    supportsPrivateFiles: () => privateStorage,
  };
  const core = {
    contentContainers: [
      { definition: testAccessBoards, pluginId: ACCESS_PLUGIN_ID },
    ],
    contentModels: [
      accessTopics,
      accessReplies,
      accessArticles,
      accessCategories,
    ].map(model => ({ model, pluginId: ACCESS_PLUGIN_ID })),
    storage: { adapter: {} },
  };

  const values = (userId: null | number): Record<string, unknown> => ({
    cache,
    core,
    db: memory.db,
    events: {
      emit: async (name: string, payload: Record<string, unknown>) => {
        emitted.push({ name, payload });

        return await Promise.resolve({ failures: [] });
      },
    },
    storage,
    user: userId === null ? null : { id: userId, roleId: ROLE.MEMBER },
  });

  /** A fresh request context for `userId`, outside any route. */
  const contextFor = (userId: null | number = null): Context => {
    const given = values(userId);

    return { get: (key: string) => given[key] } as unknown as Context;
  };

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    const header = c.req.header("x-user");
    for (const [key, value] of Object.entries(
      values(header ? Number(header) : null),
    )) {
      c.set(key as never, value as never);
    }
    await next();
  });
  app.onError((error, c) =>
    error instanceof HTTPException
      ? error.getResponse()
      : c.json({ error: String(error) }, 500),
  );
  const mount = (
    path: string,
    routes: { handler: unknown; route: unknown }[],
  ) => {
    const sub = new OpenAPIHono();
    for (const { handler, route } of routes) {
      sub.openapi(route as never, handler as never);
    }
    app.route(path, sub);
  };
  mount(
    "/boards",
    buildContentContainerPublicRoutes(testAccessBoards, {
      pluginId: ACCESS_PLUGIN_ID,
    }),
  );
  mount(
    "/topics",
    buildContentPublicRoutes(accessTopics, { pluginId: ACCESS_PLUGIN_ID }),
  );
  // Topics expose no file, so the public module would not mount this.
  mount("/topic-files", [
    contentFileDownloadRoute(accessTopics, { pluginId: ACCESS_PLUGIN_ID }),
  ]);
  mount(
    "/replies",
    buildContentPublicRoutes(accessReplies, { pluginId: ACCESS_PLUGIN_ID }),
  );

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
    cache,
    contextFor,
    /** What the request context of `userId` holds, for a test's own app. */
    contextValues: values,
    emitted,
    memory,
    opened,
    send,
  };
};

export type AccessWorld = Awaited<ReturnType<typeof createAccessWorld>>;
