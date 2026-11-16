import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { core_content_revisions } from "@/database/content";
import {
  BOARD,
  createPolicyWorld,
  POLICY_LIVE,
  POLICY_PLUGIN_ID,
  policyTopicRow,
  policyTopics,
  USER,
} from "@/tests/content-policies";

const TOPIC = { CHILD: 20, DRAFT: 31, LIVE: 30, OPEN: 10 } as const;

/** Seeded submissions, oldest first. */
const SUBMISSION = { CHILD: 4, CREATE: 1, EDIT: 2, OPEN: 3 } as const;

const submission = (
  id: number,
  itemId: number,
  containerId: number,
  overrides: Record<string, unknown> = {},
) => ({
  authorId: USER.MEMBER,
  baseUpdatedAt: POLICY_LIVE,
  baseValues: { board: containerId, title: `Topic ${itemId}` },
  baseVersion: 1,
  containerDefinitionId: "test.policy-boards",
  containerId,
  contentTypeId: policyTopics.definition.id,
  createdAt: new Date(POLICY_LIVE.getTime() + id * 60_000),
  decidedAt: null,
  id,
  itemId: String(itemId),
  kind: "edit",
  pluginId: POLICY_PLUGIN_ID,
  reason: null,
  revisionId: null,
  reviewerId: null,
  status: "pending",
  updatedAt: POLICY_LIVE,
  values: { title: "Proposed title" },
  ...overrides,
});

const world = async () =>
  await createPolicyWorld({
    submissions: [
      submission(SUBMISSION.CREATE, TOPIC.DRAFT, BOARD.APPROVE, {
        baseUpdatedAt: null,
        baseValues: null,
        baseVersion: null,
        kind: "create",
        values: { board: BOARD.APPROVE, title: `Topic ${TOPIC.DRAFT}` },
      }),
      submission(SUBMISSION.EDIT, TOPIC.LIVE, BOARD.APPROVE),
      submission(SUBMISSION.OPEN, TOPIC.OPEN, BOARD.OPEN, {
        authorId: USER.OTHER_MEMBER,
      }),
      submission(SUBMISSION.CHILD, TOPIC.CHILD, BOARD.OPEN_CHILD, {
        authorId: USER.OTHER_MEMBER,
      }),
    ],
    topics: [
      policyTopicRow(TOPIC.OPEN, BOARD.OPEN),
      policyTopicRow(TOPIC.CHILD, BOARD.OPEN_CHILD),
      policyTopicRow(TOPIC.LIVE, BOARD.APPROVE),
      policyTopicRow(TOPIC.DRAFT, BOARD.APPROVE, {
        publishedAt: null,
        status: "draft",
      }),
    ],
  });

const topic = (
  memory: Awaited<ReturnType<typeof world>>["memory"],
  id: number,
) => memory.rows(policyTopics.table).find(row => row.id === id);

const submissionRow = (
  submissions: Awaited<ReturnType<typeof world>>["submissions"],
  id: number,
) => submissions().find(row => row.id === id);

const idsOf = async (response: Response) =>
  ((await response.json()) as { items: { id: number }[] }).items.map(
    item => item.id,
  );

describe("GET /moderation/approvals", () => {
  it.each([
    ["a moderator of one board", USER.MOD_APPROVE, [1, 2]],
    ["a moderator of a board but not its children", USER.MOD_OPEN, [3]],
    ["a moderator of a board's subtree", USER.MOD_OPEN_TREE, [3, 4]],
    ["a root moderator", USER.ROOT, [1, 2, 3, 4]],
  ])("shows %s only the submissions in scope", async (_label, user, ids) => {
    const { send } = await world();

    const response = await send("GET", "/moderation/approvals", { user });

    expect(response.status).toBe(200);
    await expect(idsOf(response)).resolves.toEqual(ids);
  });

  it.each([
    ["an anonymous visitor", undefined, 401],
    ["a member who is not staff", USER.MEMBER, 403],
  ])("refuses %s with %i", async (_label, user, status) => {
    const { send } = await world();

    const response = await send("GET", "/moderation/approvals", { user });

    expect(response.status).toBe(status);
  });
});

describe("a submission outside the moderator's scope", () => {
  it.each([
    ["GET", `/moderation/approvals/${SUBMISSION.CREATE}`, undefined],
    ["POST", `/moderation/approvals/${SUBMISSION.CREATE}/approve`, undefined],
    [
      "POST",
      `/moderation/approvals/${SUBMISSION.CREATE}/reject`,
      { reason: "No" },
    ],
  ])(
    "answers %s %s with 404 and changes nothing",
    async (method, path, body) => {
      const { events, memory, send, submissions } = await world();
      const before = [submissions(), memory.rows(policyTopics.table)];

      const response = await send(method, path, { body, user: USER.MOD_OPEN });

      expect(response.status).toBe(404);
      expect([submissions(), memory.rows(policyTopics.table)]).toEqual(before);
      expect(events()).toEqual([]);
    },
  );
});

describe("approving and rejecting", () => {
  it("publishes an approved create and announces it once", async () => {
    const { emitted, events, memory, send, submissions } = await world();

    const response = await send(
      "POST",
      `/moderation/approvals/${SUBMISSION.CREATE}/approve`,
      { user: USER.MOD_APPROVE },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: SUBMISSION.CREATE,
      status: "approved",
    });
    expect(topic(memory, TOPIC.DRAFT)).toMatchObject({
      publishedAt: expect.any(Date),
      status: "published",
    });
    expect(submissionRow(submissions, SUBMISSION.CREATE)).toMatchObject({
      decidedAt: expect.any(Date),
      reviewerId: USER.MOD_APPROVE,
      status: "approved",
    });
    expect(
      events().filter(name => name === "content.test.policy-topic.published"),
    ).toHaveLength(1);
    expect(
      emitted.filter(event => event.name === "content.approval.approved"),
    ).toEqual([
      {
        name: "content.approval.approved",
        payload: expect.objectContaining({
          authorId: USER.MEMBER,
          containerId: BOARD.APPROVE,
          contentId: String(TOPIC.DRAFT),
          kind: "create",
          reviewerId: USER.MOD_APPROVE,
          submissionId: SUBMISSION.CREATE,
        }),
      },
    ]);
    expect((await send("GET", `/topics/topic-${TOPIC.DRAFT}`)).status).toBe(
      200,
    );
  });

  it("applies an approved edit as a new version", async () => {
    const { events, memory, send } = await world();

    const response = await send(
      "POST",
      `/moderation/approvals/${SUBMISSION.EDIT}/approve`,
      { user: USER.MOD_APPROVE },
    );

    expect(response.status).toBe(200);
    expect(topic(memory, TOPIC.LIVE)).toMatchObject({
      title: "Proposed title",
      version: 2,
    });
    expect(memory.rows(core_content_revisions)).toEqual([
      expect.objectContaining({ itemId: String(TOPIC.LIVE), version: 2 }),
    ]);
    expect(events()).toEqual([
      "content.test.policy-topic.updated",
      "content.approval.approved",
    ]);
  });

  it("keeps the live values on a rejection and stores the reason", async () => {
    const { emitted, memory, send, submissions } = await world();
    const before = topic(memory, TOPIC.LIVE);

    const response = await send(
      "POST",
      `/moderation/approvals/${SUBMISSION.EDIT}/reject`,
      { body: { reason: "Off topic" }, user: USER.MOD_APPROVE },
    );

    expect(response.status).toBe(200);
    expect(topic(memory, TOPIC.LIVE)).toEqual(before);
    expect(submissionRow(submissions, SUBMISSION.EDIT)).toMatchObject({
      reason: "Off topic",
      status: "rejected",
    });
    expect(emitted).toEqual([
      {
        name: "content.approval.rejected",
        payload: expect.objectContaining({
          reason: "Off topic",
          submissionId: SUBMISSION.EDIT,
        }),
      },
    ]);
  });

  it("answers a second decision with 409 decided", async () => {
    const { send } = await world();
    await send("POST", `/moderation/approvals/${SUBMISSION.EDIT}/approve`, {
      user: USER.MOD_APPROVE,
    });

    const response = await send(
      "POST",
      `/moderation/approvals/${SUBMISSION.EDIT}/reject`,
      { body: { reason: "Changed my mind" }, user: USER.MOD_APPROVE },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: "decided" });
  });

  it("answers 409 stale when a moderator edited the record since the proposal", async () => {
    const { memory, send, submissions } = await world();
    const edited = await send("PATCH", `/topics/${TOPIC.LIVE}`, {
      body: { expectedVersion: 1, values: { title: "Moderator title" } },
      user: USER.MOD_APPROVE,
    });
    expect(edited.status).toBe(200);

    const response = await send(
      "POST",
      `/moderation/approvals/${SUBMISSION.EDIT}/approve`,
      { user: USER.MOD_APPROVE },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: "stale" });
    expect(topic(memory, TOPIC.LIVE)).toMatchObject({
      title: "Moderator title",
    });
    expect(submissionRow(submissions, SUBMISSION.EDIT)).toMatchObject({
      status: "pending",
    });
  });

  it("cancels the submission of a record that is gone and answers 409 gone", async () => {
    const { events, memory, send, submissions } = await world();
    await memory.db
      .delete(policyTopics.table)
      .where(eq(policyTopics.table.id, TOPIC.DRAFT));

    const response = await send(
      "POST",
      `/moderation/approvals/${SUBMISSION.CREATE}/approve`,
      { user: USER.MOD_APPROVE },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: "gone" });
    expect(submissionRow(submissions, SUBMISSION.CREATE)).toMatchObject({
      status: "cancelled",
    });
    expect(events()).toEqual([]);
  });
});

describe("GET /moderation/approvals/mine", () => {
  it("lists only the signed-in author's submissions, newest first", async () => {
    const { send } = await world();

    const response = await send("GET", "/moderation/approvals/mine", {
      user: USER.MEMBER,
    });

    expect(response.status).toBe(200);
    await expect(idsOf(response)).resolves.toEqual([
      SUBMISSION.EDIT,
      SUBMISSION.CREATE,
    ]);
  });

  it("asks an anonymous visitor to sign in", async () => {
    const { send } = await world();

    expect((await send("GET", "/moderation/approvals/mine")).status).toBe(401);
  });
});
