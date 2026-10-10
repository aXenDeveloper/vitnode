// @vitest-environment node
import type { Context } from "hono";
import type { MockInstance } from "vitest";

import { OpenAPIHono } from "@hono/zod-openapi";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import {
  core_content_drafts,
  core_content_field_locks,
} from "@/database/content-drafts";
import { core_languages } from "@/database/languages";
import { core_users } from "@/database/users";
import { createTestCache } from "@/tests/cache";
import {
  testCategoryContentType,
  testEditorialNoteContentType,
  testEditorialPostContentType,
  testLocalizedGuideContentType,
} from "@/tests/content-fixtures";
import { createMemoryDb } from "@/tests/memory-db";
import {
  grantStaffPermissions,
  ROOT_STAFF_PERMISSIONS,
} from "@/tests/staff-permissions";
import { realtime } from "@/ws/registry";

import { CONTENT_PERMISSIONS } from "../const";
import { CONTENT_FIELD_LOCK_LEASE_MS } from "../live/protocol";
import { cleanupStaleContentDrafts, commitContentDrafts } from "./live-store";
import { contentLiveUserLeft, resetContentLiveRecord } from "./live/hooks";
import { createContentModel } from "./model";
import { buildContentRoutes } from "./routes";

const PLUGIN_ID = "@vitnode/example";
const guides = createContentModel(testLocalizedGuideContentType);
const notes = createContentModel(testEditorialNoteContentType);

const ANNA = 1;
const BEN = 2;
const VIEWER = 3;
const ROOM = { contentTypeId: guides.definition.id, itemId: 7 };

const users = [
  { id: ANNA, name: "Anna" },
  { id: BEN, name: "Ben" },
  { id: VIEWER, name: "Vic" },
];

const viewOnly = (): PermissionsStaffArgs[] => [
  {
    module: guides.definition.permissionModule,
    permission: CONTENT_PERMISSIONS.view,
    plugin: PLUGIN_ID,
  },
];

const harness = async ({ core }: { core?: Record<string, unknown> } = {}) => {
  const memory = createMemoryDb([
    [core_users, users],
    [
      core_languages,
      [
        { code: "en", default: true, id: 1 },
        { code: "pl", default: false, id: 2 },
      ],
    ],
  ]);
  const cache = createTestCache();
  await grantStaffPermissions(cache, {
    permissions: ROOT_STAFF_PERMISSIONS,
    userId: ANNA,
  });
  await grantStaffPermissions(cache, {
    permissions: ROOT_STAFF_PERMISSIONS,
    userId: BEN,
  });
  await grantStaffPermissions(cache, {
    permissions: viewOnly(),
    userId: VIEWER,
  });

  vi.spyOn(guides, "service").mockReturnValue({
    findRowById: async (id: number) =>
      await Promise.resolve(id === 7 ? { id, version: 3 } : null),
  } as never);
  vi.spyOn(guides, "translationService", "get").mockReturnValue(
    () =>
      ({
        findByLocale: async (_id: number, locale: string) =>
          await Promise.resolve(locale === "pl" ? { version: 5 } : null),
      }) as never,
  );

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    const id = Number(c.req.header("x-user") ?? ANNA);
    c.set("admin", {
      user: users.find(user => user.id === id),
    } as unknown as Context["var"]["admin"]);
    c.set("cache", cache);
    c.set("db", memory.db as unknown as Context["var"]["db"]);
    if (core) c.set("core", core as never);
    await next();
  });
  for (const { handler, route } of buildContentRoutes(guides, {
    pluginId: PLUGIN_ID,
  })) {
    app.openapi(route, handler);
  }

  const send = async (
    method: string,
    path: string,
    { body, user = ANNA }: { body?: unknown; user?: number } = {},
  ) =>
    await app.request(path, {
      method,
      headers: {
        "content-type": "application/json",
        "x-user": String(user),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  const lock = async (
    action: "acquire" | "release" | "renew",
    {
      field = "title",
      locale = "pl",
      user = ANNA,
    }: { field?: string; locale?: null | string; user?: number } = {},
  ) =>
    await send("POST", "/7/locks", {
      body: { action, field, locale },
      user,
    });

  const context = {
    get: (key: string) => {
      if (key === "db") return memory.db;
      if (key === "core") return core;

      return undefined;
    },
  } as unknown as Context;

  return { context, lock, memory, send };
};

let toRoom: MockInstance<typeof realtime.toRoom>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
  toRoom = vi.spyOn(realtime, "toRoom").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const broadcasts = (type: string) =>
  toRoom.mock.calls
    .map(([, , data]) => data as { type: string })
    .filter(message => message.type === type);

describe("field locks", () => {
  it("gives a free field to the first editor and tells the room", async () => {
    const { lock } = await harness();

    const response = await lock("acquire");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      lock: { field: "title", locale: "pl", user: { id: ANNA, name: "Anna" } },
    });
    expect(toRoom).toHaveBeenCalledWith(
      "content:test.localized-guide:7",
      expect.anything(),
      expect.objectContaining({
        locks: [expect.objectContaining({ field: "title", locale: "pl" })],
        room: ROOM,
        type: "locks",
      }),
    );
  });

  it("refuses a held field with a 409 naming the holder", async () => {
    const { lock } = await harness();
    await lock("acquire");

    const response = await lock("acquire", { user: BEN });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "CONTENT_FIELD_LOCKED",
      lock: { user: { id: ANNA, name: "Anna" } },
    });
  });

  it("locks the same field separately in each language", async () => {
    const { lock } = await harness();
    await lock("acquire", { locale: "pl" });

    const response = await lock("acquire", { locale: "en", user: BEN });

    expect(response.status).toBe(200);
  });

  it("renews only the holder's lease", async () => {
    const { lock } = await harness();
    await lock("acquire");
    vi.setSystemTime(new Date("2026-10-08T12:00:30Z"));

    const renewed = await lock("renew");
    const stolen = await lock("renew", { user: BEN });

    expect(renewed.status).toBe(200);
    const body = (await renewed.json()) as { lock: { expiresAt: string } };
    expect(body.lock.expiresAt).toBe(
      new Date(
        Date.parse("2026-10-08T12:00:30Z") + CONTENT_FIELD_LOCK_LEASE_MS,
      ).toISOString(),
    );
    expect(stolen.status).toBe(409);
  });

  it("lets someone else take an expired lease", async () => {
    const { lock, send } = await harness();
    await lock("acquire");
    vi.setSystemTime(
      new Date(
        Date.parse("2026-10-08T12:00:01Z") + CONTENT_FIELD_LOCK_LEASE_MS,
      ),
    );

    const response = await lock("acquire", { user: BEN });
    const list = await send("GET", "/7/locks");

    expect(response.status).toBe(200);
    await expect(list.json()).resolves.toMatchObject({
      locks: [{ field: "title", user: { name: "Ben" } }],
    });
  });

  it("lists only unexpired locks", async () => {
    const { lock, send } = await harness();
    await lock("acquire");
    vi.setSystemTime(
      new Date(
        Date.parse("2026-10-08T12:00:01Z") + CONTENT_FIELD_LOCK_LEASE_MS,
      ),
    );

    const response = await send("GET", "/7/locks");

    await expect(response.json()).resolves.toEqual({ locks: [] });
  });

  it("releases only the holder's lock, idempotently", async () => {
    const { lock, send } = await harness();
    await lock("acquire");

    const byOther = await lock("release", { user: BEN });
    const held = await send("GET", "/7/locks");
    const byHolder = await lock("release");
    const again = await lock("release");
    const after = await send("GET", "/7/locks");

    expect(byOther.status).toBe(200);
    await expect(held.json()).resolves.toMatchObject({
      locks: [{ user: { id: ANNA } }],
    });
    expect(byHolder.status).toBe(200);
    expect(again.status).toBe(200);
    await expect(after.json()).resolves.toEqual({ locks: [] });
    expect(broadcasts("locks")).toHaveLength(2);
  });

  it.each([
    ["a localized field without a locale", { field: "title", locale: null }],
    ["a shared field with a locale", { field: "featured", locale: "pl" }],
    ["an unknown locale", { field: "title", locale: "xx" }],
    ["an unknown field", { field: "nope", locale: null }],
  ])("refuses %s", async (_name, target) => {
    const { lock } = await harness();

    const response = await lock("acquire", target);

    expect(response.status).toBe(400);
  });

  it("answers 404 for a record that is not there", async () => {
    const { send } = await harness();

    const response = await send("POST", "/8/locks", {
      body: { action: "acquire", field: "featured", locale: null },
    });

    expect(response.status).toBe(404);
  });

  it.each([
    ["GET", "/7/locks", undefined],
    [
      "POST",
      "/7/locks",
      { action: "acquire", field: "featured", locale: null },
    ],
    ["GET", "/7/draft", undefined],
    ["PUT", "/7/draft", { locale: null, values: { featured: true } }],
    ["POST", "/7/draft/discard", {}],
  ])("refuses %s %s without can_edit", async (method, path, body) => {
    const { send } = await harness();

    const response = await send(method, path, { body, user: VIEWER });

    expect(response.status).toBe(403);
  });
});

describe("the shared draft", () => {
  it("refuses fields the caller holds no lock on", async () => {
    const { send } = await harness();

    const response = await send("PUT", "/7/draft", {
      body: { locale: "pl", values: { title: "Cześć" } },
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: "CONTENT_FIELD_NOT_LOCKED",
      fields: ["title"],
    });
  });

  it("refuses a lock held in another language", async () => {
    const { lock, send } = await harness();
    await lock("acquire", { locale: "en" });

    const response = await send("PUT", "/7/draft", {
      body: { locale: "pl", values: { title: "Cześć" } },
    });

    expect(response.status).toBe(409);
  });

  it.each([
    ["a shared field with a locale", "pl", { featured: true }],
    ["a localized field without one", null, { title: "Hello" }],
  ])("refuses %s", async (_name, locale, values) => {
    const { send } = await harness();

    const response = await send("PUT", "/7/draft", {
      body: { locale, values },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "CONTENT_DRAFT_WRONG_SCOPE",
    });
  });

  it("refuses a value the field itself would refuse", async () => {
    const { lock, send } = await harness();
    await lock("acquire");

    const response = await send("PUT", "/7/draft", {
      body: { locale: "pl", values: { title: "x".repeat(201) } },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "CONTENT_DRAFT_INVALID",
      fields: ["title"],
    });
  });

  it("merges two editors' fields into one draft and tells the room", async () => {
    const { lock, send } = await harness();
    await lock("acquire", { field: "title" });
    await lock("acquire", { field: "summary", user: BEN });

    const first = await send("PUT", "/7/draft", {
      body: { locale: "pl", values: { title: "Cześć" } },
    });
    const second = await send("PUT", "/7/draft", {
      body: { locale: "pl", values: { summary: "Krótko" } },
      user: BEN,
    });
    const read = await send("GET", "/7/draft");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    await expect(read.json()).resolves.toEqual({
      shared: null,
      translations: {
        pl: {
          baseVersion: 5,
          updatedAt: "2026-10-08T12:00:00.000Z",
          updatedBy: { id: BEN, name: "Ben" },
          values: { summary: "Krótko", title: "Cześć" },
        },
      },
    });
    expect(broadcasts("draft")).toEqual([
      expect.objectContaining({
        by: { id: ANNA, name: "Anna" },
        locale: "pl",
        room: ROOM,
        values: { title: "Cześć" },
      }),
      expect.objectContaining({
        by: { id: BEN, name: "Ben" },
        values: { summary: "Krótko" },
      }),
    ]);
  });

  it("keeps the shared draft apart, on the record's version", async () => {
    const { lock, send } = await harness();
    await lock("acquire", { field: "featured", locale: null });

    await send("PUT", "/7/draft", {
      body: { locale: null, values: { featured: true } },
    });
    const read = await send("GET", "/7/draft");

    await expect(read.json()).resolves.toMatchObject({
      shared: { baseVersion: 3, values: { featured: true } },
      translations: {},
    });
  });
});

describe("lifecycle", () => {
  it("drops a record's drafts and locks when it is reset", async () => {
    const { context, lock, memory, send } = await harness();
    await lock("acquire");
    await send("PUT", "/7/draft", {
      body: { locale: "pl", values: { title: "Cześć" } },
    });

    await resetContentLiveRecord(context, ROOM, "restored");

    expect(memory.rows(core_content_drafts)).toEqual([]);
    expect(memory.rows(core_content_field_locks)).toEqual([]);
    expect(broadcasts("reset")).toEqual([
      { reason: "restored", room: ROOM, type: "reset" },
    ]);
  });

  it("discards the shared draft on request and tells the room", async () => {
    const { lock, memory, send } = await harness();
    await lock("acquire");
    await send("PUT", "/7/draft", {
      body: { locale: "pl", values: { title: "Cześć" } },
    });

    const response = await send("POST", "/7/draft/discard", { body: {} });

    expect(response.status).toBe(200);
    expect(memory.rows(core_content_drafts)).toEqual([]);
    expect(broadcasts("reset")).toEqual([
      { reason: "discarded", room: ROOM, type: "reset" },
    ]);
  });

  it("does not discard the draft of a record that does not exist", async () => {
    const { send } = await harness();

    const response = await send("POST", "/404/draft/discard", { body: {} });

    expect(response.status).toBe(404);
    expect(broadcasts("reset")).toEqual([]);
  });

  it("drops the drafts a save committed and tells the room", async () => {
    const { context, lock, memory, send } = await harness();
    await lock("acquire");
    await send("PUT", "/7/draft", {
      body: { locale: "pl", values: { title: "Cześć" } },
    });

    await commitContentDrafts(context, ROOM, {
      locales: ["pl"],
      savedFrom: new Date(),
    });

    expect(memory.rows(core_content_drafts)).toEqual([]);
    expect(broadcasts("committed")).toEqual([
      { room: ROOM, type: "committed" },
    ]);
  });

  it("keeps other languages and drafts written after the save began", async () => {
    const { context, lock, memory, send } = await harness();
    await lock("acquire");
    await lock("acquire", { field: "featured", locale: null });
    await send("PUT", "/7/draft", {
      body: { locale: "pl", values: { title: "Cześć" } },
    });
    await send("PUT", "/7/draft", {
      body: { locale: null, values: { featured: true } },
    });

    await commitContentDrafts(context, ROOM, {
      locales: ["pl"],
      savedFrom: new Date(Date.now() - 1000),
    });
    await commitContentDrafts(context, ROOM, {
      locales: ["en"],
      savedFrom: new Date(),
    });

    expect(memory.rows(core_content_drafts)).toHaveLength(2);
    expect(broadcasts("committed")).toEqual([]);
  });

  it("releases the locks of someone who left, and only theirs", async () => {
    const { context, lock, send } = await harness();
    await lock("acquire", { field: "title" });
    await lock("acquire", { field: "summary", user: BEN });

    await contentLiveUserLeft({ c: context, room: ROOM, userId: ANNA });
    const list = await send("GET", "/7/locks");

    await expect(list.json()).resolves.toMatchObject({
      locks: [{ field: "summary", user: { id: BEN } }],
    });
    expect(broadcasts("locks").at(-1)).toMatchObject({
      locks: [{ field: "summary" }],
    });
  });

  it("sweeps expired locks and stale drafts the record moved past", async () => {
    const core = {
      contentModels: [{ model: guides, pluginId: PLUGIN_ID }],
    };
    const { context, lock, memory, send } = await harness({ core });
    await lock("acquire", { field: "featured", locale: null });
    await send("PUT", "/7/draft", {
      body: { locale: null, values: { featured: true } },
    });
    await lock("acquire");
    await send("PUT", "/7/draft", {
      body: { locale: "pl", values: { title: "Cześć" } },
    });
    // The shared draft was written on version 3 and the record is now at 4; the
    // Polish one is still level with its translation.
    vi.spyOn(guides, "service").mockReturnValue({
      findRowById: async () => await Promise.resolve({ id: 7, version: 4 }),
    } as never);
    vi.setSystemTime(new Date("2026-11-20T12:00:00Z"));

    const swept = await cleanupStaleContentDrafts(context);

    expect(swept).toEqual({ drafts: 1, locks: 2 });
    expect(memory.rows(core_content_drafts)).toEqual([
      expect.objectContaining({ language: "pl" }),
    ]);
  });
});

describe("route registration", () => {
  it("mounts the live routes for editorial content types only", () => {
    const paths = buildContentRoutes(
      createContentModel(testCategoryContentType),
      { pluginId: PLUGIN_ID },
    ).map(entry => entry.route.path);

    expect(paths).not.toContain("/{id}/locks");
    expect(
      buildContentRoutes(notes, { pluginId: PLUGIN_ID }).map(
        entry => `${entry.route.method} ${entry.route.path}`,
      ),
    ).toEqual(
      expect.arrayContaining([
        "get /{id}/locks",
        "post /{id}/locks",
        "get /{id}/draft",
        "put /{id}/draft",
      ]),
    );
  });
});

describe("mounting", () => {
  const livePaths = (routes: { route: { method: string; path: string } }[]) =>
    routes
      .map(({ route }) => `${route.method.toUpperCase()} ${route.path}`)
      .filter(path => /\/(locks|draft)/.test(path));

  it("leaves an editorial content type without `liveEditing` alone", () => {
    expect(
      livePaths(
        buildContentRoutes(createContentModel(testEditorialPostContentType), {
          pluginId: PLUGIN_ID,
        }),
      ),
    ).toEqual([]);
  });

  it("adds the lock and draft routes once `liveEditing` is on", () => {
    expect(
      livePaths(buildContentRoutes(notes, { pluginId: PLUGIN_ID })),
    ).toEqual(expect.arrayContaining(["GET /{id}/locks", "PUT /{id}/draft"]));
  });
});
