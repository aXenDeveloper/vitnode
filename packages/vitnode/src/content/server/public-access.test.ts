import { describe, expect, it } from "vitest";

import {
  ACCESS_RULES,
  BOARD,
  createAccessWorld,
  ROLE,
  testAccessBoards,
  TOPIC,
  USER,
} from "@/tests/content-access";

import { CONTENT_ACCESS_REQUIRED_CODE } from "../access/const";

interface Page {
  edges: { id: number }[];
  pageInfo: { count: number; totalCount: number };
}

describe("public lists", () => {
  it.each([
    [undefined, [TOPIC.OPEN, TOPIC.OPEN_CHILD]],
    [USER.MEMBER, [TOPIC.OPEN, TOPIC.MEMBERS, TOPIC.READERS, TOPIC.OPEN_CHILD]],
    [USER.VIP, Object.values(TOPIC).sort((a, b) => a - b)],
  ])("lists only what user %s may read", async (user, expected) => {
    const world = await createAccessWorld();

    const response = await world.send("GET", "/topics", { user });
    const body = (await response.json()) as Page;

    expect(body.edges.map(edge => edge.id)).toEqual(expected);
    expect(body.pageInfo.totalCount).toBe(expected.length);
  });

  it("filters before paginating, so a page and its total never count the rest", async () => {
    const world = await createAccessWorld();

    const body = (await (
      await world.send("GET", "/topics?first=1")
    ).json()) as Page;

    expect(body.edges.map(edge => edge.id)).toEqual([TOPIC.OPEN]);
    expect(body.pageInfo).toMatchObject({ count: 1, totalCount: 2 });
  });

  it.each([
    [BOARD.VIP, 404],
    [BOARD.READERS, 403],
  ])(
    "answers a filter on board %i the guest cannot read with %i",
    async (board, status) => {
      const world = await createAccessWorld();

      expect((await world.send("GET", `/topics?board=${board}`)).status).toBe(
        status,
      );
    },
  );
});

describe("public detail", () => {
  it.each([
    ["a record in a scope the guest may not see", TOPIC.VIP, undefined, 404],
    ["a record that does not exist", 999, undefined, 404],
    ["a record a member may read", TOPIC.READERS, USER.MEMBER, 200],
  ])("answers %s with %i", async (_label, id, user, status) => {
    const world = await createAccessWorld();

    expect(
      (await world.send("GET", `/topics/topic-${id}`, { user })).status,
    ).toBe(status);
  });

  it("says only that access is required in a scope the guest may see but not read", async () => {
    const world = await createAccessWorld();

    const response = await world.send("GET", `/topics/topic-${TOPIC.READERS}`);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      accessRequired: true,
      code: CONTENT_ACCESS_REQUIRED_CODE,
    });
  });
});

describe("caching", () => {
  it.each([["/topics"], [`/topics/topic-${TOPIC.OPEN}`], ["/boards"]])(
    "keeps GET %s out of shared caches once any scope is restricted",
    async path => {
      const world = await createAccessWorld();

      const response = await world.send("GET", path);

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    },
  );

  it.each([["/topics"], [`/topics/topic-${TOPIC.OPEN}`], ["/boards"]])(
    "lets GET %s be shared while nothing is restricted",
    async path => {
      const world = await createAccessWorld({ rules: {} });

      const response = await world.send("GET", path);

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBeNull();
    },
  );
});

describe("replies", () => {
  const rules = {
    ...ACCESS_RULES,
    [testAccessBoards.id]: {
      ...ACCESS_RULES[testAccessBoards.id],
      [BOARD.READERS]: {
        comment: { mode: "roles" as const, roleIds: [ROLE.VIP] },
        read: { mode: "members" as const },
      },
    },
  };

  it.each([
    ["a guest", undefined, TOPIC.OPEN, 401],
    ["a member, in a thread they may not see", USER.MEMBER, TOPIC.VIP, 404],
    ["a member, without the comment rule", USER.MEMBER, TOPIC.READERS, 403],
    ["a member with the comment rule's role", USER.VIP, TOPIC.READERS, 201],
  ])("answers %s with %i", async (_label, user, topic, status) => {
    const world = await createAccessWorld({ rules });

    const response = await world.send("POST", "/replies", {
      body: { values: { body: "Me too", topic } },
      user,
    });

    expect(response.status).toBe(status);
  });
});
