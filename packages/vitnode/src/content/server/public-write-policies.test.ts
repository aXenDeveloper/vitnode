import { describe, expect, it } from "vitest";

import { core_content_revisions } from "@/database/content";
import {
  BOARD,
  createPolicyWorld,
  policyReplies,
  policyReplyRow,
  policyTopicRow,
  policyTopics,
  USER,
} from "@/tests/content-policies";

import type { ContentPublicWriteRejection } from "../conflicts";

import {
  CONTENT_PUBLIC_WRITE_CODES,
  CONTENT_PUBLIC_WRITE_ISSUE_CODES,
} from "../const";

const TOPIC = {
  APPROVE: 30,
  CHILD: 20,
  LOCKED: 50,
  OPEN: 10,
  OTHER: 11,
} as const;

const REPLY = { OLD: 100, OTHER_ROOT: 110, RECENT: 101 } as const;

const world = async () =>
  await createPolicyWorld({
    replies: [
      policyReplyRow(REPLY.OLD, TOPIC.OPEN),
      policyReplyRow(REPLY.RECENT, TOPIC.OPEN, { createdAt: new Date() }),
      policyReplyRow(REPLY.OTHER_ROOT, TOPIC.OTHER),
    ],
    topics: [
      policyTopicRow(TOPIC.OPEN, BOARD.OPEN),
      policyTopicRow(TOPIC.OTHER, BOARD.OPEN),
      policyTopicRow(TOPIC.CHILD, BOARD.OPEN_CHILD),
      policyTopicRow(TOPIC.APPROVE, BOARD.APPROVE),
      policyTopicRow(TOPIC.LOCKED, BOARD.LOCKED),
    ],
  });

const rejection = async (
  response: Response,
): Promise<ContentPublicWriteRejection> =>
  (await response.json()) as ContentPublicWriteRejection;

interface WriteRecord {
  approval: null | {
    id: number;
    kind: string;
    status: string;
    values: null | Record<string, unknown>;
  };
  id: number;
  slug: string;
  status: string;
  values: Record<string, unknown>;
  version?: number;
}

const topicIn = (board: number) => ({
  values: { board, title: "Hello world" },
});

describe("creating in a board with policies", () => {
  it("publishes at once in an immediate board", async () => {
    const { submissions, send } = await world();

    const response = await send("POST", "/topics", {
      body: topicIn(BOARD.OPEN),
      user: USER.MEMBER,
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      approval: null,
      status: "published",
    });
    expect(submissions()).toEqual([]);
  });

  it("stores a draft the public cannot read and opens a submission in an approve board", async () => {
    const { emitted, events, send, submissions } = await world();

    const response = await send("POST", "/topics", {
      body: topicIn(BOARD.APPROVE),
      user: USER.MEMBER,
    });

    expect(response.status).toBe(201);
    const record = (await response.json()) as WriteRecord;
    expect(record).toMatchObject({
      approval: { kind: "create", status: "pending" },
      publishedAt: null,
      status: "draft",
    });
    expect(submissions()).toEqual([
      expect.objectContaining({
        authorId: USER.MEMBER,
        containerId: BOARD.APPROVE,
        itemId: String(record.id),
        kind: "create",
        status: "pending",
      }),
    ]);
    expect(events()).not.toContain("content.test.policy-topic.published");
    expect(emitted).toContainEqual({
      name: "content.approval.submitted",
      payload: expect.objectContaining({
        contentId: String(record.id),
        submissionId: record.approval?.id,
      }),
    });

    expect((await send("GET", `/topics/${record.slug}`)).status).toBe(404);
    const list = (await (await send("GET", "/topics")).json()) as {
      edges: { id: number }[];
    };
    expect(list.edges.map(edge => edge.id)).toContain(TOPIC.OPEN);
    expect(list.edges.map(edge => edge.id)).not.toContain(record.id);
  });

  it.each([
    ["holds can_approve in the board", USER.MOD_APPROVE],
    ["is a root moderator", USER.ROOT],
  ])("publishes at once when the author %s", async (_label, user) => {
    const { send, submissions } = await world();

    const response = await send("POST", "/topics", {
      body: topicIn(BOARD.APPROVE),
      user,
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      approval: null,
      status: "published",
    });
    expect(submissions()).toEqual([]);
  });

  it.each([
    ["a member", USER.MEMBER, 403],
    ["a moderator of another board", USER.MOD_OPEN, 403],
    ["a root moderator", USER.ROOT, 201],
  ])(
    "lets only can_edit holders start a topic in a moderators board: %s gets %i",
    async (_label, user, status) => {
      const { events, rows, send } = await world();
      const before = rows(policyTopics.table);

      const response = await send("POST", "/topics", {
        body: topicIn(BOARD.MODERATORS),
        user,
      });

      expect(response.status).toBe(status);
      if (status === 201) return;
      await expect(rejection(response)).resolves.toEqual({
        code: CONTENT_PUBLIC_WRITE_CODES.forbidden,
        contentTypeId: policyTopics.definition.id,
        issues: [
          {
            code: CONTENT_PUBLIC_WRITE_ISSUE_CODES.moderatorsOnly,
            field: null,
            message: expect.any(String),
          },
        ],
      });
      expect(rows(policyTopics.table)).toEqual(before);
      expect(events()).toEqual([]);
    },
  );
});

describe("an author editing a published record in an approve board", () => {
  const propose = async (
    send: Awaited<ReturnType<typeof world>>["send"],
    title: string,
  ) =>
    await send("PATCH", `/topics/${TOPIC.APPROVE}`, {
      body: { expectedVersion: 1, values: { title } },
      user: USER.MEMBER,
    });

  it("stores a proposal and leaves the live row and its version alone", async () => {
    const { events, rows, send, submissions } = await world();
    const before = rows(policyTopics.table);

    const response = await propose(send, "Proposed title");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      approval: {
        kind: "edit",
        status: "pending",
        values: { title: "Proposed title" },
      },
      values: { title: `Topic ${TOPIC.APPROVE}` },
      version: 1,
    });
    expect(rows(policyTopics.table)).toEqual(before);
    expect(rows(core_content_revisions)).toEqual([]);
    expect(submissions()).toEqual([
      expect.objectContaining({
        baseValues: { board: BOARD.APPROVE, title: `Topic ${TOPIC.APPROVE}` },
        baseVersion: 1,
        kind: "edit",
        status: "pending",
        values: { title: "Proposed title" },
      }),
    ]);
    expect(events()).toEqual(["content.approval.submitted"]);
  });

  it("replaces a pending proposal with the newer one", async () => {
    const { emitted, send, submissions } = await world();

    await propose(send, "First proposal");
    const response = await propose(send, "Second proposal");

    expect(response.status).toBe(200);
    const [first, second] = submissions();
    expect(first).toMatchObject({ status: "superseded" });
    expect(second).toMatchObject({
      status: "pending",
      values: { title: "Second proposal" },
    });
    expect(emitted.at(-1)).toEqual({
      name: "content.approval.submitted",
      payload: expect.objectContaining({
        replacedSubmissionId: first?.id,
        submissionId: second?.id,
      }),
    });
  });
});

describe("the author edit window", () => {
  it.each([
    [
      "a topic in a board where authors never edit",
      `/topics/${TOPIC.LOCKED}`,
      { expectedVersion: 1, values: { title: "Too late" } },
      403,
    ],
    [
      "a reply older than its window",
      `/replies/${REPLY.OLD}`,
      { values: { body: "Too late" } },
      403,
    ],
    [
      "a reply still inside its window",
      `/replies/${REPLY.RECENT}`,
      { values: { body: "Just in time" } },
      200,
    ],
  ])(
    "answers an author editing %s with %i",
    async (_label, path, body, status) => {
      const { events, memory, send } = await world();
      const before = [
        memory.rows(policyTopics.table),
        memory.rows(policyReplies.table),
      ];

      const response = await send("PATCH", path, { body, user: USER.MEMBER });

      expect(response.status).toBe(status);
      if (status === 200) return;
      await expect(rejection(response)).resolves.toMatchObject({
        code: CONTENT_PUBLIC_WRITE_CODES.forbidden,
        issues: [
          {
            code: CONTENT_PUBLIC_WRITE_ISSUE_CODES.editWindowClosed,
            field: null,
          },
        ],
      });
      expect([
        memory.rows(policyTopics.table),
        memory.rows(policyReplies.table),
      ]).toEqual(before);
      expect(events()).toEqual([]);
    },
  );
});

describe("a moderator with can_edit scoped to one board", () => {
  it.each([
    ["their board", TOPIC.OPEN, 200],
    ["a board below theirs (a plain id is not a subtree)", TOPIC.CHILD, 403],
    ["another board", TOPIC.APPROVE, 403],
  ])("editing a member's topic in %s gets %i", async (_label, id, status) => {
    const { rows, send } = await world();

    const response = await send("PATCH", `/topics/${id}`, {
      body: { expectedVersion: 1, values: { title: "Moderated title" } },
      user: USER.MOD_OPEN,
    });

    expect(response.status).toBe(status);
    expect(rows(policyTopics.table).find(row => row.id === id)?.title).toBe(
      status === 200 ? "Moderated title" : `Topic ${id}`,
    );
  });

  it("edits a reply in their board after the author's window closed", async () => {
    const { send } = await world();

    const response = await send("PATCH", `/replies/${REPLY.OLD}`, {
      body: { values: { body: "Moderated" } },
      user: USER.MOD_OPEN,
    });

    expect(response.status).toBe(200);
  });
});

describe("a reply inherits its topic's board", () => {
  it.each([
    ["an immediate board", TOPIC.OPEN, "published", []],
    [
      "an approve board",
      TOPIC.APPROVE,
      "draft",
      [{ containerId: BOARD.APPROVE, kind: "create", status: "pending" }],
    ],
  ])("applies the policy of %s", async (_label, topic, status, expected) => {
    const { send, submissions } = await world();

    const response = await send("POST", "/replies", {
      body: { values: { body: "An answer", topic } },
      user: USER.MEMBER,
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ status });
    expect(submissions()).toEqual(
      expected.map(entry => expect.objectContaining(entry)),
    );
  });

  it("refuses a board sent by the client", async () => {
    const { send } = await world();

    const response = await send("POST", "/replies", {
      body: {
        values: { board: BOARD.OPEN, body: "An answer", topic: TOPIC.APPROVE },
      },
      user: USER.MEMBER,
    });

    expect(response.status).toBe(400);
    expect((await rejection(response)).issues).toContainEqual(
      expect.objectContaining({
        code: CONTENT_PUBLIC_WRITE_ISSUE_CODES.notWritable,
        field: "board",
      }),
    );
  });
});

describe("thread placement", () => {
  it("refuses a parent from another topic, on the parent field", async () => {
    const { events, rows, send } = await world();
    const before = rows(policyReplies.table);

    const response = await send("POST", "/replies", {
      body: {
        values: {
          body: "Wrong place",
          parent: REPLY.OTHER_ROOT,
          topic: TOPIC.OPEN,
        },
      },
      user: USER.MEMBER,
    });

    expect(response.status).toBe(400);
    expect((await rejection(response)).issues).toEqual([
      expect.objectContaining({ field: "parent" }),
    ]);
    expect(rows(policyReplies.table)).toEqual(before);
    expect(events()).toEqual([]);
  });
});
