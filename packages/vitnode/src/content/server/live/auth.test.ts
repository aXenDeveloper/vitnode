// @vitest-environment node
import type { Context, Next } from "hono";

import { describe, expect, it } from "vitest";

import type { EnvVariablesVitNode } from "@/api/middlewares/global.middleware";
import type { ContentLiveDocRef } from "@/content/live/protocol";
import type { AnyContentTypeDefinition } from "@/content/types";

import { CONTENT_PERMISSIONS } from "@/content/const";
import { createContentModel } from "@/content/server/model";
import { core_languages } from "@/database/languages";
import {
  testCategoryContentType,
  testEditorialNoteContentType,
  testLocalizedGuideContentType,
} from "@/tests/content-fixtures";
import {
  createSessionWorld,
  fakeSession,
  sessionCookies,
} from "@/tests/sessions";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import {
  authorizeContentLive,
  createContentLiveAuthCache,
  isContentLiveDocValid,
} from "./auth";

const PLUGIN_ID = "@vitnode/example";
const notes = createContentModel(testEditorialNoteContentType);
const categories = createContentModel(testCategoryContentType);

const guideWithRichText = {
  ...testLocalizedGuideContentType,
  fields: {
    ...testLocalizedGuideContentType.fields,
    content: { kind: "richText", localized: true, nullable: true },
    intro: { kind: "richText", nullable: true },
  },
} as unknown as AnyContentTypeDefinition;

const DEVICE = { id: 3, publicId: "laptop" };
const editor = fakeSession(7, DEVICE);
const userOnly = fakeSession(8, DEVICE, ["user"]);

const CAN_EDIT = {
  module: testEditorialNoteContentType.permissionModule,
  permission: CONTENT_PERMISSIONS.edit,
  plugin: PLUGIN_ID,
};

const setup = async () => {
  const world = await createSessionWorld({
    extraTables: [
      [
        notes.table,
        [
          {
            body: null,
            createdAt: new Date(),
            id: 1,
            title: "Hello",
            updatedAt: new Date(),
            version: 4,
          },
        ],
      ],
      [
        core_languages,
        [
          { code: "en", default: true, id: 1, name: "English" },
          { code: "pl", default: false, id: 2, name: "Polski" },
        ],
      ],
    ],
    sessions: [editor, userOnly],
  });

  world.app.use("*", async (c: Context, next: Next) => {
    c.set("core", {
      ...c.get("core"),
      contentModels: [
        { model: notes, pluginId: PLUGIN_ID },
        { model: categories, pluginId: PLUGIN_ID },
      ],
      contentTypes: [
        { definition: testEditorialNoteContentType, pluginId: PLUGIN_ID },
        { definition: testCategoryContentType, pluginId: PLUGIN_ID },
        { definition: guideWithRichText, pluginId: PLUGIN_ID },
      ],
      i18n: { locales: [] },
    } as unknown as EnvVariablesVitNode["core"]);
    await next();
  });
  world.app.get("/authorize/:type/:id", async c =>
    c.json(
      await authorizeContentLive(c, {
        contentTypeId: c.req.param("type"),
        itemId: Number(c.req.param("id")),
      }),
    ),
  );
  world.app.post("/doc", async c =>
    c.json({
      valid: await isContentLiveDocValid(c, await c.req.json()),
    }),
  );

  const authorize = async (
    session: null | ReturnType<typeof fakeSession>,
    room = { contentTypeId: "test.note", itemId: 1 },
  ) => {
    const response = await world.app.request(
      `/authorize/${room.contentTypeId}/${room.itemId}`,
      session
        ? { headers: { cookie: sessionCookies(session, "admin") } }
        : undefined,
    );

    return (await response.json()) as Awaited<
      ReturnType<typeof authorizeContentLive>
    >;
  };

  const isValid = async (doc: ContentLiveDocRef) => {
    const response = await world.app.request("/doc", {
      body: JSON.stringify(doc),
      method: "POST",
    });

    return ((await response.json()) as { valid: boolean }).valid;
  };

  return { authorize, isValid, world };
};

describe("authorizing a live room", () => {
  it("refuses a socket without an AdminCP session", async () => {
    const { authorize } = await setup();

    expect(await authorize(null)).toEqual({ code: "FORBIDDEN", ok: false });
    expect(await authorize(userOnly)).toEqual({
      code: "FORBIDDEN",
      ok: false,
    });
  });

  it("refuses an admin without can_edit on the content type", async () => {
    const { authorize, world } = await setup();
    await grantStaffPermissions(world.cache, {
      permissions: [{ ...CAN_EDIT, permission: CONTENT_PERMISSIONS.view }],
      userId: editor.userId,
    });

    expect(await authorize(editor)).toEqual({ code: "FORBIDDEN", ok: false });
  });

  it("accepts an admin with can_edit, naming the editor and the version", async () => {
    const { authorize, world } = await setup();
    await grantStaffPermissions(world.cache, {
      permissions: [CAN_EDIT],
      userId: editor.userId,
    });

    expect(await authorize(editor)).toMatchObject({
      ok: true,
      user: { id: editor.userId, name: `user-${editor.userId}` },
      version: 4,
    });
  });

  it("answers NOT_FOUND for a missing record", async () => {
    const { authorize, world } = await setup();
    await grantStaffPermissions(world.cache, {
      permissions: [CAN_EDIT],
      userId: editor.userId,
    });

    expect(
      await authorize(editor, { contentTypeId: "test.note", itemId: 99 }),
    ).toEqual({ code: "NOT_FOUND", ok: false });
  });

  it("has no room for a content type without editorial workflow", async () => {
    const { authorize, world } = await setup();
    await grantStaffPermissions(world.cache, {
      permissions: [
        { ...CAN_EDIT, module: testCategoryContentType.permissionModule },
      ],
      userId: editor.userId,
    });

    expect(
      await authorize(editor, { contentTypeId: "test.category", itemId: 1 }),
    ).toEqual({ code: "NOT_FOUND", ok: false });
  });
});

describe("the authorization cache", () => {
  const room = { contentTypeId: "test.note", itemId: 1 };
  const granted = {
    ok: true as const,
    user: { avatarColor: null, id: 1, name: "Anna", nameCode: null },
    version: 1,
  };

  it("checks again once a positive answer is older than the TTL", async () => {
    let at = 0;
    let calls = 0;
    const cache = createContentLiveAuthCache({
      authorize: async () => {
        calls++;

        return Promise.resolve(granted);
      },
      now: () => at,
      ttlMs: 60_000,
    });
    const socket = {};
    const c = {} as Context;

    await cache.authorize(c, socket, room);
    at = 59_000;
    await cache.authorize(c, socket, room);

    expect(calls).toBe(1);

    at = 60_000;
    await cache.authorize(c, socket, room);

    expect(calls).toBe(2);
  });

  it("never remembers a refusal, and keeps sockets apart", async () => {
    const answers = [
      { code: "FORBIDDEN" as const, ok: false as const },
      granted,
      granted,
    ];
    const cache = createContentLiveAuthCache({
      authorize: async () => Promise.resolve(answers.shift() ?? granted),
    });
    const c = {} as Context;
    const socket = {};

    expect((await cache.authorize(c, socket, room)).ok).toBe(false);
    expect((await cache.authorize(c, socket, room)).ok).toBe(true);
    expect(answers).toHaveLength(1);

    await cache.authorize(c, {}, room);

    expect(answers).toHaveLength(0);
  });
});

describe("a collaborative document reference", () => {
  const doc = (overrides: Partial<ContentLiveDocRef>): ContentLiveDocRef => ({
    contentTypeId: "test.localized-guide",
    field: "content",
    itemId: 1,
    locale: "en",
    ...overrides,
  });

  it("accepts a localized rich text field in an existing language", async () => {
    const { isValid } = await setup();

    expect(await isValid(doc({}))).toBe(true);
    expect(await isValid(doc({ locale: "pl" }))).toBe(true);
  });

  it("refuses an unknown or a non-canonical language, or none", async () => {
    const { isValid } = await setup();

    expect(await isValid(doc({ locale: "de" }))).toBe(false);
    expect(await isValid(doc({ locale: "EN" }))).toBe(false);
    expect(await isValid(doc({ locale: null }))).toBe(false);
  });

  it("wants no language for a shared rich text field", async () => {
    const { isValid } = await setup();

    expect(await isValid(doc({ field: "intro", locale: null }))).toBe(true);
    expect(await isValid(doc({ field: "intro", locale: "en" }))).toBe(false);
  });

  it("refuses fields that are not rich text, or do not exist", async () => {
    const { isValid } = await setup();

    expect(await isValid(doc({ field: "body" }))).toBe(false);
    expect(await isValid(doc({ field: "constructor" }))).toBe(false);
    expect(await isValid(doc({ contentTypeId: "test.note" }))).toBe(false);
  });
});
