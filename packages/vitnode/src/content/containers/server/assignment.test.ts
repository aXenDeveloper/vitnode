import type { Context, MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";

import { core_content_containers } from "@/database/content-containers";
import { createTestCache } from "@/tests/cache";
import {
  testCategoryContentType,
  testThreadContentType,
} from "@/tests/content-fixtures";
import { createMemoryDb } from "@/tests/memory-db";
import {
  grantStaffPermissions,
  ROOT_STAFF_PERMISSIONS,
} from "@/tests/staff-permissions";

import type { ContentDatabase } from "../../server/service";

import { createContentModel } from "../../server/model";
import { buildContentRoutes } from "../../server/routes";
import { ContentContainerAssignmentError } from "../association";
import { resolveContentContainerAssignment } from "./assignment";

const PLUGIN_ID = "@vitnode/example";
const CREATED = new Date("2026-09-01T10:00:00.000Z");
const BOARD = { ELSEWHERE: 9, GENERAL: 1, HELP: 2, MISSING: 99 } as const;
const THREAD = 7;

const threads = createContentModel(testThreadContentType);

const container = (
  id: number,
  slug: string,
  definitionId: string,
  parentId: null | number = null,
) => ({
  createdAt: CREATED,
  definitionId,
  id,
  metadata: {},
  name: slug,
  parentId,
  pluginId: PLUGIN_ID,
  position: 0,
  slug,
  updatedAt: CREATED,
});

const seed = () =>
  createMemoryDb([
    [
      core_content_containers,
      [
        container(BOARD.GENERAL, "general", "test.boards"),
        container(BOARD.HELP, "help", "test.boards", BOARD.GENERAL),
        container(BOARD.ELSEWHERE, "elsewhere", "test.sections"),
      ],
    ],
    [
      threads.table,
      [
        {
          author: 1,
          board: BOARD.GENERAL,
          createdAt: CREATED,
          id: THREAD,
          publishedAt: null,
          slug: "hello",
          status: "draft",
          title: "Hello",
          updatedAt: CREATED,
        },
      ],
    ],
  ]);

const contextOf = (memory: ReturnType<typeof createMemoryDb>) =>
  ({
    get: (key: string) =>
      key === "db"
        ? memory.db
        : key === "events"
          ? { emit: async () => await Promise.resolve({ failures: [] }) }
          : undefined,
  }) as unknown as Context;

const failureOf = async (run: () => Promise<unknown>) =>
  await run().then(
    () => null,
    (error: unknown) => error,
  );

describe("resolveContentContainerAssignment", () => {
  const resolve = async (values: Record<string, unknown>) =>
    await resolveContentContainerAssignment(
      seed().db as unknown as ContentDatabase,
      testThreadContentType,
      values,
    );

  it("returns the container the write names, read back from the database", async () => {
    await expect(resolve({ board: BOARD.HELP })).resolves.toEqual({
      definitionId: "test.boards",
      id: BOARD.HELP,
      parentId: BOARD.GENERAL,
      pluginId: PLUGIN_ID,
      slug: "help",
    });
  });

  it.each([
    ["a write that does not touch the container", {}, undefined],
    ["a write that clears it", { board: null }, null],
  ])("passes %s through", async (_label, values, expected) => {
    await expect(resolve(values)).resolves.toBe(expected);
  });

  it("ignores a content type without a container field", async () => {
    await expect(
      resolveContentContainerAssignment(
        seed().db as unknown as ContentDatabase,
        testCategoryContentType,
        { board: BOARD.MISSING },
      ),
    ).resolves.toBeUndefined();
  });

  it.each([
    ["a container that does not exist", BOARD.MISSING, "CONTAINER_NOT_FOUND"],
    ["a zero id", 0, "CONTAINER_NOT_FOUND"],
    ["an id that is not a number", String(BOARD.HELP), "CONTAINER_NOT_FOUND"],
    [
      "another collection's container",
      BOARD.ELSEWHERE,
      "CONTAINER_DEFINITION_MISMATCH",
    ],
  ])("refuses %s and names the field", async (_label, board, code) => {
    const error = await failureOf(async () => await resolve({ board }));

    expect(error).toBeInstanceOf(ContentContainerAssignmentError);
    expect(error).toMatchObject({ code, field: "board" });
  });
});

describe("the content service checks the container on every write", () => {
  it("creates a record inside a container of its collection", async () => {
    const memory = seed();

    const created = await threads
      .service(contextOf(memory))
      .create({ author: 1, board: BOARD.HELP, title: "Second thread" });

    expect(
      memory.rows(threads.table).find(row => row.id === created.id),
    ).toMatchObject({ board: BOARD.HELP });
  });

  it("moves a record into another container of its collection", async () => {
    const memory = seed();

    await threads
      .service(contextOf(memory))
      .update(THREAD, { board: BOARD.HELP });

    expect(
      memory.rows(threads.table).find(row => row.id === THREAD),
    ).toMatchObject({ board: BOARD.HELP });
  });

  it.each([
    ["create", BOARD.MISSING, "CONTAINER_NOT_FOUND"],
    ["create", BOARD.ELSEWHERE, "CONTAINER_DEFINITION_MISMATCH"],
    ["update", BOARD.MISSING, "CONTAINER_NOT_FOUND"],
    ["update", BOARD.ELSEWHERE, "CONTAINER_DEFINITION_MISMATCH"],
  ])(
    "refuses to %s a record in container %i and writes nothing",
    async (operation, board, code) => {
      const memory = seed();
      const service = threads.service(contextOf(memory));
      const before = memory.rows(threads.table);

      const error = await failureOf(async () =>
        operation === "create"
          ? await service.create({ author: 1, board, title: "Lost thread" })
          : await service.update(THREAD, { board }),
      );

      expect(error).toMatchObject({ code, field: "board" });
      expect(memory.rows(threads.table)).toEqual(before);
    },
  );
});

describe("the generated admin routes", () => {
  it("answer a container of another collection with 400 naming the field", async () => {
    const memory = seed();
    const cache = createTestCache();
    await grantStaffPermissions(cache, {
      permissions: ROOT_STAFF_PERMISSIONS,
      userId: 1,
    });

    const app = new OpenAPIHono();
    const context: MiddlewareHandler = async (c, next) => {
      c.set("admin", {
        user: { id: 1, roleId: 1 },
      } as unknown as Context["var"]["admin"]);
      c.set("cache", cache);
      c.set("db", memory.db as unknown as Context["var"]["db"]);
      c.set("events", {
        emit: async () => await Promise.resolve({ failures: [] }),
      } as unknown as Context["var"]["events"]);
      await next();
    };
    app.use("*", context);
    app.onError((error, c) =>
      error instanceof HTTPException
        ? error.getResponse()
        : c.json({ error: String(error) }, 500),
    );
    for (const { handler, route } of buildContentRoutes(threads, {
      pluginId: PLUGIN_ID,
    })) {
      app.openapi(route, handler);
    }

    const response = await app.request("/", {
      body: JSON.stringify({
        author: 1,
        board: BOARD.ELSEWHERE,
        title: "Lost thread",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "CONTAINER_DEFINITION_MISMATCH",
      field: "board",
      message: expect.any(String),
    });
    expect(memory.rows(threads.table)).toHaveLength(1);
  });
});
