import type { Context, Next } from "hono";

import { describe, expect, it } from "vitest";

import type { EnvVariablesVitNode } from "@/api/middlewares/global.middleware";
import type { ContentRefreshScope } from "@/content/live/refresh";

import { SessionModel } from "@/api/models/session";
import { CONTENT_PERMISSIONS } from "@/content/const";
import { core_content_revisions } from "@/database/content";
import { core_content_containers } from "@/database/content-containers";
import { core_content_submissions } from "@/database/content-submissions";
import {
  BOARD,
  POLICY_LIVE,
  POLICY_PLUGIN_ID,
  policyBoardRows,
  policyReplies,
  policyTopicRow,
  policyTopics,
} from "@/tests/content-policies";
import {
  createSessionWorld,
  fakeSession,
  sessionCookies,
} from "@/tests/sessions";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { authorizeContentRefresh } from "./auth";

const TOPIC = { DRAFT: 2, HIDDEN: 3, LIVE: 1 } as const;
const REPLY_TYPE = policyReplies.definition.id;
const TOPIC_TYPE = policyTopics.definition.id;

const DEVICE = { id: 3, publicId: "laptop" };
const admin = fakeSession(7, DEVICE);
const member = fakeSession(8, DEVICE, ["user"]);
const author = fakeSession(9, DEVICE, ["user"]);

const CAN_VIEW_TOPICS = {
  module: policyTopics.definition.permissionModule,
  permission: CONTENT_PERMISSIONS.view,
  plugin: POLICY_PLUGIN_ID,
};

const setup = async () => {
  const world = await createSessionWorld({
    extraTables: [
      [core_content_containers, policyBoardRows()],
      [
        policyTopics.table,
        [
          policyTopicRow(TOPIC.LIVE, BOARD.OPEN),
          policyTopicRow(TOPIC.DRAFT, BOARD.OPEN, {
            publishedAt: null,
            status: "draft",
          }),
          policyTopicRow(TOPIC.HIDDEN, BOARD.OPEN, {
            author: author.userId,
            hiddenAt: POLICY_LIVE,
            hiddenBy: 99,
          }),
        ],
      ],
      [policyReplies.table, []],
      [core_content_revisions, []],
      [core_content_submissions, []],
    ],
    sessions: [admin, member, author],
  });

  world.app.use("*", async (c: Context, next: Next) => {
    c.set("core", {
      ...c.get("core"),
      contentModels: [
        { model: policyTopics, pluginId: POLICY_PLUGIN_ID },
        { model: policyReplies, pluginId: POLICY_PLUGIN_ID },
      ],
      contentTypes: [
        { definition: policyTopics.definition, pluginId: POLICY_PLUGIN_ID },
        { definition: policyReplies.definition, pluginId: POLICY_PLUGIN_ID },
      ],
      moderation: { scopes: [], targets: [] },
      permissionStaff: [],
    } as unknown as EnvVariablesVitNode["core"]);
    await next();
  });
  world.app.post("/authorize", async c =>
    c.json(
      await authorizeContentRefresh(c, await c.req.json<ContentRefreshScope>()),
    ),
  );
  // An open WebSocket keeps the user it was opened with, even after sign-out.
  world.app.post("/authorize-after-sign-out", async c => {
    await new SessionModel(c).deleteSession();

    return c.json(
      await authorizeContentRefresh(c, await c.req.json<ContentRefreshScope>()),
    );
  });

  const authorize = async (
    scope: ContentRefreshScope,
    {
      as,
      kind = "admin",
      signedOut = false,
    }: {
      as?: typeof admin;
      kind?: "admin" | "user";
      signedOut?: boolean;
    } = {},
  ) => {
    const response = await world.app.request(
      signedOut ? "/authorize-after-sign-out" : "/authorize",
      {
        body: JSON.stringify(scope),
        headers: as ? { cookie: sessionCookies(as, kind) } : {},
        method: "POST",
      },
    );

    return (await response.json()) as Awaited<
      ReturnType<typeof authorizeContentRefresh>
    >;
  };

  return { authorize, world };
};

const thread = (rootId: number | string): ContentRefreshScope => ({
  contentTypeId: REPLY_TYPE,
  kind: "thread",
  rootId,
});

const NOT_FOUND = { code: "NOT_FOUND", ok: false };
const FORBIDDEN = { code: "FORBIDDEN", ok: false };

describe("authorizeContentRefresh for a thread", () => {
  it("lets a guest follow the thread of a public root", async () => {
    const { authorize } = await setup();

    expect(await authorize(thread(TOPIC.LIVE))).toStrictEqual({ ok: true });
  });

  it.each([
    ["a draft", thread(TOPIC.DRAFT)],
    ["a hidden", thread(TOPIC.HIDDEN)],
    ["a missing", thread(999)],
    ["a malformed", thread("abc")],
    [
      "a content type without threads, for",
      { contentTypeId: TOPIC_TYPE, kind: "thread", rootId: TOPIC.LIVE },
    ],
    [
      "an unknown content type, for",
      { contentTypeId: "test.nope", kind: "thread", rootId: TOPIC.LIVE },
    ],
  ] satisfies [string, ContentRefreshScope][])(
    "answers NOT_FOUND for %s root",
    async (_label, scope) => {
      const { authorize } = await setup();

      expect(await authorize(scope)).toStrictEqual(NOT_FOUND);
    },
  );

  it("lets a signed-in reader follow a public thread only while their session exists", async () => {
    const { authorize, world } = await setup();
    const reader = { as: member, kind: "user" } as const;

    expect(await authorize(thread(TOPIC.LIVE), reader)).toStrictEqual({
      ok: true,
    });
    expect(
      await authorize(thread(TOPIC.LIVE), { ...reader, signedOut: true }),
    ).toStrictEqual(FORBIDDEN);
    expect(world.rowsFor(member).user).toBe(0);
  });

  it("lets the author of a hidden root follow its thread", async () => {
    const { authorize } = await setup();

    expect(
      await authorize(thread(TOPIC.HIDDEN), { as: author, kind: "user" }),
    ).toStrictEqual({ ok: true });
  });
});

describe("authorizeContentRefresh for an AdminCP list", () => {
  const list: ContentRefreshScope = {
    contentTypeId: TOPIC_TYPE,
    kind: "admin",
  };

  it.each([
    ["without a session", undefined, "admin"],
    ["with only a member session", member, "user"],
    ["with an admin session lacking can_view", admin, "admin"],
  ] as const)("refuses %s", async (_label, as, kind) => {
    const { authorize } = await setup();

    expect(await authorize(list, { as, kind })).toStrictEqual(FORBIDDEN);
  });

  it("accepts an AdminCP session with the content type's can_view", async () => {
    const { authorize, world } = await setup();
    await grantStaffPermissions(world.cache, {
      permissions: [CAN_VIEW_TOPICS],
      userId: admin.userId,
    });

    expect(await authorize(list, { as: admin })).toStrictEqual({ ok: true });
  });
});
