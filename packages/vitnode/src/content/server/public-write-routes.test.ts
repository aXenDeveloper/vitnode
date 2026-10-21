import type { Table } from "drizzle-orm";
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { afterEach, describe, expect, it, vi } from "vitest";

import { core_content_revisions } from "@/database/content";
import { core_content_containers } from "@/database/content-containers";
import { createTestCache } from "@/tests/cache";
import {
  testEditorialTopicContentType,
  testForumContentType,
  testThreadContentType,
  testTopicContentType,
} from "@/tests/content-fixtures";
import { createMemoryDb } from "@/tests/memory-db";

import type { ContentPublicWriteRejection } from "../conflicts";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentModel } from "./model";

import {
  CONTENT_CONFLICT_CODES,
  CONTENT_PUBLIC_WRITE_CODES,
  CONTENT_PUBLIC_WRITE_ISSUE_CODES,
} from "../const";
import { defineContentType } from "../define";
import { field } from "../fields";
import { createContentModel } from "./model";
import { buildContentPublicRoutes } from "./public-routes";

const PLUGIN_ID = "@vitnode/example";

const OWNER = 1;
const STRANGER = 2;

const forums = createContentModel(testForumContentType);
const topics = createContentModel(testTopicContentType, {
  references: { forum: () => forums.table.id },
});
const editorialTopics = createContentModel(testEditorialTopicContentType);

const draftTopicContentType = defineContentType({
  id: "test.draft-topic",
  tableName: "test_draft_topics",
  publication: true,
  fields: {
    title: field.text({ required: true, minLength: 3, maxLength: 200 }),
    slug: field.slug({ source: "title" }),
    author: field.user(),
  },
  publicApi: { path: "draft-topics", fields: ["title", "slug"] },
  publicWrite: {
    ownership: { field: "author" },
    create: { fields: ["title"] },
  },
});
const drafts = createContentModel(draftTopicContentType);

const LIVE = new Date("2026-09-01T10:00:00.000Z");

const FORUM = { DRAFT: 2, HIDDEN: 3, LIVE: 1, MISSING: 99 } as const;
const TOPIC = { DRAFT: 11, HIDDEN: 12, LIVE: 10, MISSING: 999 } as const;

const doc = (text: string) => ({
  content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
  type: "doc",
});

const forumRows = [
  {
    id: FORUM.LIVE,
    publishedAt: LIVE,
    slug: "live",
    status: "published",
    title: "Live",
  },
  {
    id: FORUM.DRAFT,
    publishedAt: null,
    slug: "draft",
    status: "draft",
    title: "Draft",
  },
  {
    hiddenAt: LIVE,
    id: FORUM.HIDDEN,
    publishedAt: LIVE,
    slug: "hidden",
    status: "published",
    title: "Hidden",
  },
];

const topicRow = (id: number, overrides: Record<string, unknown> = {}) => ({
  author: OWNER,
  body: doc("Original"),
  createdAt: LIVE,
  forum: FORUM.LIVE,
  hiddenAt: null,
  id,
  pinned: false,
  publishedAt: LIVE,
  slug: `topic-${id}`,
  status: "published",
  title: `Topic ${id}`,
  updatedAt: LIVE,
  ...overrides,
});

const harness = (
  model: ContentModel<AnyContentTypeDefinition> = topics as never,
  seed: [Table, readonly object[]][] = [
    [
      topics.table,
      [
        topicRow(TOPIC.LIVE),
        topicRow(TOPIC.DRAFT, { publishedAt: null, status: "draft" }),
        topicRow(TOPIC.HIDDEN, { hiddenAt: LIVE }),
      ],
    ],
  ],
) => {
  const memory = createMemoryDb([
    [forums.table, forumRows],
    [core_content_revisions, []],
    ...seed,
  ]);
  const cache = createTestCache();
  const emitted: { name: string; payload: unknown }[] = [];

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    const header = c.req.header("x-user");
    c.set("user", (header ? { id: Number(header), roleId: 2 } : null) as never);
    c.set("cache", cache);
    c.set("db", memory.db as unknown as Context["var"]["db"]);
    c.set("events", {
      emit: async (name: string, payload: unknown) => {
        emitted.push({ name, payload });

        return await Promise.resolve({
          delivered: 0,
          eventId: "event",
          failures: [],
        });
      },
    } as never);
    await next();
  });
  app.onError((error, c) =>
    error instanceof HTTPException
      ? error.getResponse()
      : c.json({ error: String(error) }, 500),
  );
  for (const { handler, route } of buildContentPublicRoutes(model, {
    pluginId: PLUGIN_ID,
  })) {
    app.openapi(route, handler);
  }

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

  const rows = (table: Table = model.table) => memory.rows(table);
  const events = () => emitted.map(event => event.name);

  return { app, emitted, events, rows, send };
};

const rejection = async (
  response: Response,
): Promise<ContentPublicWriteRejection> =>
  (await response.json()) as ContentPublicWriteRejection;

const created = {
  values: { body: doc("Hello"), forum: FORUM.LIVE, title: "Hello world" },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("authentication", () => {
  it.each([
    ["POST", "/", { values: { nope: true } }],
    ["GET", `/${TOPIC.LIVE}/edit`, undefined],
    ["PATCH", `/${TOPIC.LIVE}`, { values: {} }],
  ])(
    "refuses an anonymous %s %s before reading the body",
    async (method, path, body) => {
      const { events, rows, send } = harness();
      const before = rows();

      const response = await send(method, path, { body });

      expect(response.status).toBe(401);
      await expect(rejection(response)).resolves.toEqual({
        code: CONTENT_PUBLIC_WRITE_CODES.unauthenticated,
        contentTypeId: topics.definition.id,
        issues: [],
      });
      expect(rows()).toEqual(before);
      expect(events()).toEqual([]);
    },
  );
});

describe("POST / (create)", () => {
  it("creates a record owned by the signed-in user", async () => {
    const { rows, send } = harness();

    const response = await send("POST", "/", { body: created, user: OWNER });

    expect(response.status).toBe(201);
    const record = (await response.json()) as {
      id: number;
      slug: string;
      values: Record<string, unknown>;
    };
    expect(record).toMatchObject({
      slug: "hello-world",
      values: { forum: FORUM.LIVE, title: "Hello world" },
    });
    expect(Object.keys(record.values).sort()).toEqual([
      "body",
      "forum",
      "title",
    ]);
    expect(rows().find(row => row.id === record.id)).toMatchObject({
      author: OWNER,
      pinned: false,
    });
  });

  it.each([
    ["author", STRANGER],
    ["status", "published"],
    ["nope", 1],
  ])("refuses %s in the payload and names it", async (key, value) => {
    const { events, rows, send } = harness();
    const before = rows();

    const response = await send("POST", "/", {
      body: { values: { ...created.values, [key]: value } },
      user: OWNER,
    });

    expect(response.status).toBe(400);
    const body = await rejection(response);
    expect(body.code).toBe(CONTENT_PUBLIC_WRITE_CODES.invalidInput);
    expect(body.issues).toContainEqual({
      code: CONTENT_PUBLIC_WRITE_ISSUE_CODES.notWritable,
      field: key,
      message: expect.any(String),
    });
    expect(rows()).toEqual(before);
    expect(events()).toEqual([]);
  });

  it("names the field a validation rule rejected", async () => {
    const { send } = harness();

    const response = await send("POST", "/", {
      body: { values: { ...created.values, title: "ab" } },
      user: OWNER,
    });

    expect(response.status).toBe(400);
    expect((await rejection(response)).issues).toEqual([
      { code: "too_small", field: "title", message: expect.any(String) },
    ]);
  });

  it("refuses a body that is not JSON", async () => {
    const { app } = harness();

    const response = await app.request("/", {
      body: "{",
      headers: { "content-type": "application/json", "x-user": String(OWNER) },
      method: "POST",
    });

    expect(response.status).toBe(400);
    await expect(rejection(response)).resolves.toMatchObject({
      code: CONTENT_PUBLIC_WRITE_CODES.invalidInput,
      issues: [
        { code: CONTENT_PUBLIC_WRITE_ISSUE_CODES.invalidJson, field: null },
      ],
    });
  });

  it("publishes straight away when the server policy says so", async () => {
    const { emitted, send } = harness();

    const response = await send("POST", "/", { body: created, user: OWNER });
    const record = (await response.json()) as {
      id: number;
      publishedAt: null | string;
      status: string;
    };

    expect(record.status).toBe("published");
    expect(record.publishedAt).not.toBeNull();
    expect(emitted).toEqual([
      { name: "content.test.topic.created", payload: { contentId: record.id } },
      {
        name: "content.test.topic.published",
        payload: { contentId: record.id, publishedAt: expect.any(Date) },
      },
    ]);
  });

  it("starts a record as a draft by default and announces only the create", async () => {
    const { events, send } = harness(drafts as never, []);

    const response = await send("POST", "/", {
      body: { values: { title: "Hello world" } },
      user: OWNER,
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      publishedAt: null,
      status: "draft",
    });
    expect(events()).toEqual(["content.test.draft-topic.created"]);
  });

  it.each([
    ["a draft", FORUM.DRAFT],
    ["a hidden", FORUM.HIDDEN],
    ["a missing", FORUM.MISSING],
  ])(
    "refuses a relation to %s record without telling which",
    async (_label, forum) => {
      const { events, rows, send } = harness();
      const before = rows();

      const response = await send("POST", "/", {
        body: { values: { ...created.values, forum } },
        user: OWNER,
      });

      expect(response.status).toBe(400);
      await expect(rejection(response)).resolves.toEqual({
        code: CONTENT_PUBLIC_WRITE_CODES.invalidInput,
        contentTypeId: topics.definition.id,
        issues: [
          {
            code: CONTENT_PUBLIC_WRITE_ISSUE_CODES.unavailable,
            field: "forum",
            message: expect.any(String),
          },
        ],
      });
      expect(rows()).toEqual(before);
      expect(events()).toEqual([]);
    },
  );

  it("answers a unique conflict with the structured 409", async () => {
    const { events, send } = harness();
    vi.spyOn(topics, "service").mockReturnValue({
      create: async () =>
        await Promise.reject(
          Object.assign(new Error("duplicate key"), { code: "23505" }),
        ),
    } as never);

    const response = await send("POST", "/", { body: created, user: OWNER });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: CONTENT_CONFLICT_CODES.unique,
      contentTypeId: topics.definition.id,
    });
    expect(events()).toEqual([]);
  });
});

describe("GET /{id}/edit", () => {
  it("returns the record, drafts included, privately", async () => {
    const { send } = harness();

    const response = await send("GET", `/${TOPIC.DRAFT}/edit`, {
      user: OWNER,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      approval: null,
      id: TOPIC.DRAFT,
      publishedAt: null,
      slug: `topic-${TOPIC.DRAFT}`,
      status: "draft",
      values: {
        body: doc("Original"),
        forum: FORUM.LIVE,
        title: `Topic ${TOPIC.DRAFT}`,
      },
    });
  });
});

describe("refusals never confirm a record the public cannot read", () => {
  it.each([
    ["GET", "/{id}/edit", STRANGER, TOPIC.LIVE, 403],
    ["GET", "/{id}/edit", STRANGER, TOPIC.DRAFT, 404],
    ["GET", "/{id}/edit", STRANGER, TOPIC.HIDDEN, 404],
    ["GET", "/{id}/edit", OWNER, TOPIC.MISSING, 404],
    ["PATCH", "/{id}", STRANGER, TOPIC.LIVE, 403],
    ["PATCH", "/{id}", STRANGER, TOPIC.DRAFT, 404],
    ["PATCH", "/{id}", STRANGER, TOPIC.HIDDEN, 404],
    ["PATCH", "/{id}", OWNER, TOPIC.MISSING, 404],
  ])(
    "%s %s as user %i on record %i is %i",
    async (method, path, user, id, status) => {
      const { events, rows, send } = harness();
      const before = rows();

      const response = await send(method, path.replace("{id}", String(id)), {
        body:
          method === "PATCH" ? { values: { title: "Taken over" } } : undefined,
        user,
      });

      expect(response.status).toBe(status);
      await expect(rejection(response)).resolves.toEqual({
        code:
          status === 403
            ? CONTENT_PUBLIC_WRITE_CODES.forbidden
            : CONTENT_PUBLIC_WRITE_CODES.notFound,
        contentTypeId: topics.definition.id,
        issues: [],
      });
      expect(rows()).toEqual(before);
      expect(events()).toEqual([]);
    },
  );
});

describe("PATCH /{id} (update)", () => {
  it("writes only the fields sent and announces what changed", async () => {
    const { emitted, rows, send } = harness();

    const response = await send("PATCH", `/${TOPIC.LIVE}`, {
      body: { values: { title: "Renamed topic" } },
      user: OWNER,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: TOPIC.LIVE,
      values: { body: doc("Original"), title: "Renamed topic" },
    });
    expect(rows().find(row => row.id === TOPIC.LIVE)).toMatchObject({
      author: OWNER,
      body: doc("Original"),
      title: "Renamed topic",
    });
    expect(emitted).toEqual([
      {
        name: "content.test.topic.updated",
        payload: { changedFields: ["title"], contentId: TOPIC.LIVE },
      },
    ]);
  });

  it("announces nothing when nothing changed", async () => {
    const { events, send } = harness();

    const response = await send("PATCH", `/${TOPIC.LIVE}`, {
      body: { values: { title: `Topic ${TOPIC.LIVE}` } },
      user: OWNER,
    });

    expect(response.status).toBe(200);
    expect(events()).toEqual([]);
  });

  it.each([
    [
      "a new owner",
      { values: { author: STRANGER } },
      { code: CONTENT_PUBLIC_WRITE_ISSUE_CODES.notWritable, field: "author" },
    ],
    ["an empty update", { values: {} }, { code: "custom", field: null }],
  ])("refuses %s and writes nothing", async (_label, body, issue) => {
    const { events, rows, send } = harness();
    const before = rows();

    const response = await send("PATCH", `/${TOPIC.LIVE}`, {
      body,
      user: OWNER,
    });

    expect(response.status).toBe(400);
    expect((await rejection(response)).issues).toContainEqual(
      expect.objectContaining(issue),
    );
    expect(rows()).toEqual(before);
    expect(events()).toEqual([]);
  });

  it("refuses a relation the public cannot read, and writes nothing", async () => {
    const { events, rows, send } = harness();
    const before = rows();

    const response = await send("PATCH", `/${TOPIC.LIVE}`, {
      body: { values: { forum: FORUM.DRAFT, title: "Renamed topic" } },
      user: OWNER,
    });

    expect(response.status).toBe(400);
    expect((await rejection(response)).issues).toEqual([
      {
        code: CONTENT_PUBLIC_WRITE_ISSUE_CODES.unavailable,
        field: "forum",
        message: expect.any(String),
      },
    ]);
    expect(rows()).toEqual(before);
    expect(events()).toEqual([]);
  });
});

describe("editorial content types", () => {
  const seeded = (): [Table, readonly object[]][] => [
    [
      editorialTopics.table,
      [
        {
          author: OWNER,
          createdAt: LIVE,
          id: 5,
          publishedAt: LIVE,
          slug: "editorial-topic",
          status: "published",
          title: "Editorial topic",
          updatedAt: LIVE,
          version: 2,
        },
      ],
    ],
  ];

  it("creates through the editorial workflow, with a first revision", async () => {
    const { rows, send } = harness(editorialTopics as never, []);

    const response = await send("POST", "/", {
      body: { values: { title: "Hello world" } },
      user: OWNER,
    });

    expect(response.status).toBe(201);
    const record = (await response.json()) as { id: number; version: number };
    expect(record).toMatchObject({ status: "draft", version: 1 });
    expect(rows(core_content_revisions)).toEqual([
      expect.objectContaining({
        contentTypeId: editorialTopics.definition.id,
        version: 1,
      }),
    ]);
  });

  it("updates against the expected version and records a revision", async () => {
    const { events, rows, send } = harness(editorialTopics as never, seeded());

    const response = await send("PATCH", "/5", {
      body: { expectedVersion: 2, values: { title: "Renamed topic" } },
      user: OWNER,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      values: { title: "Renamed topic" },
      version: 3,
    });
    expect(rows(core_content_revisions)).toEqual([
      expect.objectContaining({ version: 3 }),
    ]);
    expect(events()).toEqual(["content.test.editorial-topic.updated"]);
  });

  it("answers a stale expectedVersion with the structured 409", async () => {
    const { events, rows, send } = harness(editorialTopics as never, seeded());
    const before = rows();

    const response = await send("PATCH", "/5", {
      body: { expectedVersion: 1, values: { title: "Renamed topic" } },
      user: OWNER,
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: CONTENT_CONFLICT_CODES.version,
      currentVersion: 2,
      expectedVersion: 1,
    });
    expect(rows()).toEqual(before);
    expect(rows(core_content_revisions)).toEqual([]);
    expect(events()).toEqual([]);
  });
});

describe("a container field", () => {
  const threads = createContentModel(testThreadContentType);
  const BOARD = { ELSEWHERE: 9, GENERAL: 1, MISSING: 99 } as const;
  const THREAD = 20;

  const board = (id: number, slug: string, definitionId: string) => ({
    createdAt: LIVE,
    definitionId,
    id,
    metadata: {},
    name: slug,
    parentId: null,
    pluginId: PLUGIN_ID,
    position: 0,
    slug,
    updatedAt: LIVE,
  });

  const threadHarness = () =>
    harness(threads as never, [
      [
        core_content_containers,
        [
          board(
            BOARD.GENERAL,
            "general",
            testThreadContentType.fields.board.definition.id,
          ),
          board(BOARD.ELSEWHERE, "elsewhere", "test.sections"),
        ],
      ],
      [
        threads.table,
        [
          {
            author: OWNER,
            board: BOARD.GENERAL,
            createdAt: LIVE,
            id: THREAD,
            publishedAt: LIVE,
            slug: "first-thread",
            status: "published",
            title: "First thread",
            updatedAt: LIVE,
          },
        ],
      ],
    ]);

  it("creates a record inside the container the member picked", async () => {
    const { rows, send } = threadHarness();

    const response = await send("POST", "/", {
      body: { values: { board: BOARD.GENERAL, title: "Hello world" } },
      user: OWNER,
    });

    expect(response.status).toBe(201);
    const record = (await response.json()) as { id: number };
    expect(rows().find(row => row.id === record.id)).toMatchObject({
      author: OWNER,
      board: BOARD.GENERAL,
    });
  });

  it.each([
    ["does not exist", BOARD.MISSING],
    ["belongs to another collection", BOARD.ELSEWHERE],
  ])(
    "refuses a container that %s, on that field",
    async (_label, container) => {
      const { events, rows, send } = threadHarness();
      const before = rows();

      const response = await send("POST", "/", {
        body: { values: { board: container, title: "Hello world" } },
        user: OWNER,
      });

      expect(response.status).toBe(400);
      await expect(rejection(response)).resolves.toEqual({
        code: CONTENT_PUBLIC_WRITE_CODES.invalidInput,
        contentTypeId: threads.definition.id,
        issues: [
          {
            code: CONTENT_PUBLIC_WRITE_ISSUE_CODES.unavailable,
            field: "board",
            message: expect.any(String),
          },
        ],
      });
      expect(rows()).toEqual(before);
      expect(events()).toEqual([]);
    },
  );

  it("keeps the record in its container on an update", async () => {
    const { rows, send } = threadHarness();

    const response = await send("PATCH", `/${THREAD}`, {
      body: { values: { title: "Renamed thread" } },
      user: OWNER,
    });

    expect(response.status).toBe(200);
    expect(rows().find(row => row.id === THREAD)).toMatchObject({
      board: BOARD.GENERAL,
      title: "Renamed thread",
    });
  });

  it("never lets an author move their record to another container", async () => {
    const { events, rows, send } = threadHarness();
    const before = rows();

    const response = await send("PATCH", `/${THREAD}`, {
      body: { values: { board: BOARD.GENERAL, title: "Renamed thread" } },
      user: OWNER,
    });

    expect(response.status).toBe(400);
    expect((await rejection(response)).issues).toContainEqual({
      code: CONTENT_PUBLIC_WRITE_ISSUE_CODES.notWritable,
      field: "board",
      message: expect.any(String),
    });
    expect(rows()).toEqual(before);
    expect(events()).toEqual([]);
  });
});

describe("generated surface", () => {
  const operations = (app: OpenAPIHono) =>
    Object.fromEntries(
      Object.entries(
        app.getOpenAPI31Document({
          info: { title: "test", version: "1" },
          openapi: "3.1.0",
        }).paths ?? {},
      ).map(([path, item]) => [path, Object.keys(item ?? {}).sort()]),
    );

  it("documents the write routes beside the reads", () => {
    expect(operations(harness().app)).toEqual({
      "/": ["get", "post"],
      "/permissions": ["get"],
      "/{id}": ["patch"],
      "/{id}/edit": ["get"],
      "/{slug}": ["get"],
    });
  });

  it("generates no edit routes when only create is enabled", () => {
    expect(operations(harness(drafts as never, []).app)).toEqual({
      "/": ["get", "post"],
      "/{slug}": ["get"],
    });
  });
});
